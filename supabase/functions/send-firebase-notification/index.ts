import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  notification_id: string;
  target: string;
  target_type: 'user' | 'topic' | 'all';
}

interface FirebaseMessage {
  notification: {
    title: string;
    body: string;
    image?: string;
  };
  data?: Record<string, string>;
  android?: {
    notification: {
      click_action?: string;
      sound?: string;
      priority?: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        category?: string;
        sound?: string;
      };
    };
  };
  webpush?: {
    fcm_options: {
      link?: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // إنشاء عميل Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { notification_id, target, target_type }: NotificationRequest = await req.json()

    // جلب بيانات الإشعار من قاعدة البيانات
    const { data: notification, error: notificationError } = await supabaseClient
      .from('push_notifications')
      .select('*')
      .eq('id', notification_id)
      .single()

    if (notificationError) {
      throw new Error(`Failed to fetch notification: ${notificationError.message}`)
    }

    // تحضير رسالة Firebase
    const firebaseMessage: FirebaseMessage = {
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image_url || undefined
      },
      data: {
        ...notification.data,
        notification_id: notification_id,
        click_action: notification.click_action || 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        notification: {
          click_action: notification.click_action || 'FLUTTER_NOTIFICATION_CLICK',
          sound: notification.sound || 'default',
          priority: notification.priority === 'high' ? 'high' : 'normal'
        }
      },
      apns: {
        payload: {
          aps: {
            category: notification.click_action || 'FLUTTER_NOTIFICATION_CLICK',
            sound: notification.sound || 'default'
          }
        }
      },
      webpush: {
        fcm_options: {
          link: notification.click_action || undefined
        }
      }
    }

    let deviceTokens: string[] = []

    // تحديد الأجهزة المستهدفة
    if (target_type === 'user') {
      // جلب أجهزة المستخدم النشطة
      const { data: devices, error: devicesError } = await supabaseClient
        .from('app_devices')
        .select('device_token')
        .eq('user_id', target)
        .eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (devicesError) {
        throw new Error(`Failed to fetch user devices: ${devicesError.message}`)
      }

      deviceTokens = devices?.map(d => d.device_token) || []
    } else if (target_type === 'all') {
      // جلب جميع الأجهزة النشطة
      const { data: devices, error: devicesError } = await supabaseClient
        .from('app_devices')
        .select('device_token')
        .eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (devicesError) {
        throw new Error(`Failed to fetch all devices: ${devicesError.message}`)
      }

      deviceTokens = devices?.map(d => d.device_token) || []
    }

    // محاكاة إرسال Firebase (في التطبيق الحقيقي، ستستخدم Firebase Admin SDK)
    console.log('Sending Firebase notification:', {
      message: firebaseMessage,
      tokens: deviceTokens,
      topic: target_type === 'topic' ? target : undefined
    })

    // تحديث حالة الإشعار إلى "مرسل"
    const { error: updateError } = await supabaseClient
      .from('push_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: deviceTokens.length
      })
      .eq('id', notification_id)

    if (updateError) {
      throw new Error(`Failed to update notification status: ${updateError.message}`)
    }

    // في التطبيق الحقيقي، ستقوم بإرسال الإشعار عبر Firebase Admin SDK هنا
    // const admin = require('firebase-admin');
    // const response = await admin.messaging().sendMulticast({
    //   tokens: deviceTokens,
    //   ...firebaseMessage
    // });

    // محاكاة استجابة Firebase
    const mockResponse = {
      success: true,
      sent_count: deviceTokens.length,
      delivered_count: Math.floor(deviceTokens.length * 0.9), // 90% معدل تسليم
      failed_count: Math.floor(deviceTokens.length * 0.1),
      message_id: `mock_${notification_id}`
    }

    // تحديث إحصائيات التسليم
    await supabaseClient
      .from('push_notifications')
      .update({
        delivered_count: mockResponse.delivered_count,
        failed_count: mockResponse.failed_count
      })
      .eq('id', notification_id)

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification_id,
        sent_to: deviceTokens.length,
        firebase_response: mockResponse
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in send-firebase-notification function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})