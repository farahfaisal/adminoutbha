import { supabase } from './supabase';

/**
 * تسجيل جهاز جديد للإشعارات
 * @param {Object} deviceData - بيانات الجهاز
 * @returns {Promise<string>} - معرف الجهاز
 */
export const registerDevice = async (deviceData) => {
  try {
    const { data, error } = await supabase.rpc(
      'register_app_device',
      {
        p_user_id: deviceData.user_id,
        p_device_token: deviceData.device_token,
        p_device_type: deviceData.device_type,
        p_app_version: deviceData.app_version || null,
        p_os_version: deviceData.os_version || null,
        p_device_model: deviceData.device_model || null,
        p_device_name: deviceData.device_name || null
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error registering device:', error);
    throw error;
  }
};

/**
 * إرسال إشعار لمستخدم محدد
 * @param {Object} notificationData - بيانات الإشعار
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendNotificationToUser = async (notificationData) => {
  try {
    const { data, error } = await supabase.rpc(
      'send_push_notification_to_user',
      {
        p_user_id: notificationData.user_id,
        p_title: notificationData.title,
        p_body: notificationData.body,
        p_data: notificationData.data || {},
        p_click_action: notificationData.click_action || 'FLUTTER_NOTIFICATION_CLICK',
        p_image_url: notificationData.image_url || null,
        p_priority: notificationData.priority || 'normal'
      }
    );
    
    if (error) throw error;
    
    // إرسال الإشعار فعلياً عبر Firebase (سيتم تنفيذه في Edge Function)
    await triggerFirebaseNotification(data, notificationData.user_id);
    
    return data;
  } catch (error) {
    console.error('Error sending notification to user:', error);
    throw error;
  }
};

/**
 * إرسال إشعار لجميع المستخدمين
 * @param {Object} notificationData - بيانات الإشعار
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendNotificationToAll = async (notificationData) => {
  try {
    const { data, error } = await supabase.rpc(
      'send_push_notification_to_all',
      {
        p_title: notificationData.title,
        p_body: notificationData.body,
        p_data: notificationData.data || {},
        p_click_action: notificationData.click_action || 'FLUTTER_NOTIFICATION_CLICK',
        p_image_url: notificationData.image_url || null,
        p_priority: notificationData.priority || 'normal'
      }
    );
    
    if (error) throw error;
    
    // إرسال الإشعار فعلياً عبر Firebase
    await triggerFirebaseNotification(data, 'all');
    
    return data;
  } catch (error) {
    console.error('Error sending notification to all:', error);
    throw error;
  }
};

/**
 * إرسال إشعار لموضوع محدد
 * @param {Object} notificationData - بيانات الإشعار
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendNotificationToTopic = async (notificationData) => {
  try {
    const { data, error } = await supabase.rpc(
      'send_push_notification_to_topic',
      {
        p_topic: notificationData.topic,
        p_title: notificationData.title,
        p_body: notificationData.body,
        p_data: notificationData.data || {},
        p_click_action: notificationData.click_action || 'FLUTTER_NOTIFICATION_CLICK',
        p_image_url: notificationData.image_url || null,
        p_priority: notificationData.priority || 'normal'
      }
    );
    
    if (error) throw error;
    
    // إرسال الإشعار فعلياً عبر Firebase
    await triggerFirebaseNotification(data, notificationData.topic, 'topic');
    
    return data;
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    throw error;
  }
};

/**
 * تشغيل إرسال إشعار Firebase فعلياً
 * @param {string} notificationId - معرف الإشعار
 * @param {string} target - الهدف (user_id, topic, أو 'all')
 * @param {string} targetType - نوع الهدف
 * @returns {Promise<Object>} - نتيجة الإرسال
 */
const triggerFirebaseNotification = async (notificationId, target, targetType = 'user') => {
  try {
    // استدعاء Edge Function لإرسال الإشعار عبر Firebase
    const { data, error } = await supabase.functions.invoke('send-firebase-notification', {
      body: {
        notification_id: notificationId,
        target: target,
        target_type: targetType
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error triggering Firebase notification:', error);
    throw error;
  }
};

/**
 * الحصول على أجهزة المستخدم النشطة
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Array>} - قائمة الأجهزة
 */
export const getUserActiveDevices = async (userId) => {
  try {
    const { data, error } = await supabase.rpc(
      'get_user_active_devices',
      { p_user_id: userId }
    );
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user active devices:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات الإشعارات
 * @param {string} startDate - تاريخ البداية
 * @param {string} endDate - تاريخ النهاية
 * @returns {Promise<Object>} - إحصائيات الإشعارات
 */
export const getNotificationStats = async (startDate = null, endDate = null) => {
  try {
    const { data, error } = await supabase.rpc(
      'get_notification_stats',
      {
        p_start_date: startDate,
        p_end_date: endDate
      }
    );
    
    if (error) throw error;
    return data?.[0] || {
      total_sent: 0,
      total_delivered: 0,
      total_failed: 0,
      total_clicked: 0,
      delivery_rate: 0,
      click_rate: 0,
      active_devices: 0
    };
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    throw error;
  }
};

/**
 * الحصول على سجل الإشعارات
 * @param {Object} options - خيارات الفلترة
 * @returns {Promise<Array>} - قائمة الإشعارات
 */
export const getNotificationHistory = async (options = {}) => {
  try {
    let query = supabase
      .from('push_notification_logs')
      .select(`
        *,
        delivery_logs:push_notification_logs(
          status,
          created_at,
          error_message
        )
      `);
    
    // تطبيق الفلاتر
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.target_type) {
      query = query.eq('target_type', options.target_type);
    }
    
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    
    if (options.start_date) {
      query = query.gte('created_at', options.start_date);
    }
    
    if (options.end_date) {
      query = query.lte('created_at', options.end_date);
    }
    
    // ترتيب وتحديد العدد
    query = query
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notification history:', error);
    throw error;
  }
};

/**
 * إلغاء إشعار مجدول
 * @param {string} notificationId - معرف الإشعار
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const cancelScheduledNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('push_notification_logs')
      .update({ 
        status: 'cancelled',
        created_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('status', 'sent');
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error cancelling notification:', error);
    throw error;
  }
};

/**
 * تحديث إعدادات إشعارات الجهاز
 * @param {string} userId - معرف المستخدم
 * @param {string} deviceId - معرف الجهاز
 * @param {Object} settings - الإعدادات الجديدة
 * @returns {Promise<Object>} - الإعدادات المحدثة
 */
export const updateDeviceNotificationSettings = async (userId, deviceId, settings) => {
  try {
    const { data, error } = await supabase
      .from('app_notification_settings')
      .upsert([{
        user_id: userId,
        device_id: deviceId,
        ...settings
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating device notification settings:', error);
    throw error;
  }
};

/**
 * الحصول على إعدادات إشعارات الجهاز
 * @param {string} userId - معرف المستخدم
 * @param {string} deviceId - معرف الجهاز
 * @returns {Promise<Object>} - إعدادات الإشعارات
 */
export const getDeviceNotificationSettings = async (userId, deviceId) => {
  try {
    const { data, error } = await supabase
      .from('app_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (error) throw error;
    
    // إرجاع إعدادات افتراضية إذا لم توجد
    return data || {
      notifications_enabled: true,
      sound_enabled: true,
      vibration_enabled: true,
      led_enabled: true,
      order_notifications: true,
      payment_notifications: true,
      promotion_notifications: true,
      system_notifications: true
    };
  } catch (error) {
    console.error('Error fetching device notification settings:', error);
    throw error;
  }
};

/**
 * إرسال إشعار طلب جديد للبائع
 * @param {string} vendorUserId - معرف مستخدم البائع
 * @param {Object} orderData - بيانات الطلب
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendNewOrderNotification = async (vendorUserId, orderData) => {
  try {
    return await sendNotificationToUser({
      user_id: vendorUserId,
      title: 'طلب جديد! 🛒',
      body: `لديك طلب جديد بقيمة ${orderData.total} شيكل من ${orderData.customer_name}`,
      data: {
        type: 'new_order',
        order_id: orderData.id,
        action: 'view_order',
        vendor_id: orderData.vendor_id
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'high'
    });
  } catch (error) {
    console.error('Error sending new order notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار تعيين طلب للسائق
 * @param {string} driverUserId - معرف مستخدم السائق
 * @param {Object} orderData - بيانات الطلب
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendOrderAssignedNotification = async (driverUserId, orderData) => {
  try {
    return await sendNotificationToUser({
      user_id: driverUserId,
      title: 'طلب توصيل جديد! 🚚',
      body: `تم تعيين طلب توصيل لك بقيمة ${orderData.total} شيكل`,
      data: {
        type: 'order_assigned',
        order_id: orderData.id,
        action: 'view_delivery',
        customer_address: orderData.address
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'high'
    });
  } catch (error) {
    console.error('Error sending order assigned notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار تحديث حالة الطلب للعميل
 * @param {string} customerUserId - معرف مستخدم العميل
 * @param {Object} orderData - بيانات الطلب
 * @param {string} status - الحالة الجديدة
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendOrderStatusUpdateNotification = async (customerUserId, orderData, status) => {
  try {
    const statusMessages = {
      'accepted': 'تم قبول طلبك ✅',
      'processing': 'جاري تحضير طلبك 👨‍🍳',
      'delivering': 'طلبك في الطريق إليك 🚚',
      'completed': 'تم توصيل طلبك بنجاح 🎉',
      'cancelled': 'تم إلغاء طلبك ❌'
    };
    
    const title = statusMessages[status] || 'تحديث على طلبك';
    
    return await sendNotificationToUser({
      user_id: customerUserId,
      title: title,
      body: `طلب رقم ${orderData.order_number || orderData.id.substring(0, 8)}`,
      data: {
        type: 'order_status_update',
        order_id: orderData.id,
        status: status,
        action: 'view_order'
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: status === 'completed' ? 'high' : 'normal'
    });
  } catch (error) {
    console.error('Error sending order status update notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار دفع للعميل
 * @param {string} customerUserId - معرف مستخدم العميل
 * @param {Object} paymentData - بيانات الدفع
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendPaymentNotification = async (customerUserId, paymentData) => {
  try {
    return await sendNotificationToUser({
      user_id: customerUserId,
      title: 'تم استلام دفعتك 💳',
      body: `تم استلام دفعة بقيمة ${paymentData.amount} شيكل بنجاح`,
      data: {
        type: 'payment_received',
        transaction_id: paymentData.transaction_id,
        amount: paymentData.amount,
        action: 'view_wallet'
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'normal'
    });
  } catch (error) {
    console.error('Error sending payment notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار شحن المحفظة
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ المشحون
 * @param {string} transactionId - معرف المعاملة
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendWalletChargeNotification = async (userId, amount, transactionId) => {
  try {
    return await sendNotificationToUser({
      user_id: userId,
      title: 'تم شحن محفظتك 💰',
      body: `تم إضافة ${amount} شيكل إلى محفظتك`,
      data: {
        type: 'wallet_charged',
        transaction_id: transactionId,
        amount: amount,
        action: 'view_wallet'
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'normal'
    });
  } catch (error) {
    console.error('Error sending wallet charge notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار رصيد منخفض
 * @param {string} userId - معرف المستخدم
 * @param {number} balance - الرصيد الحالي
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendLowBalanceNotification = async (userId, balance) => {
  try {
    return await sendNotificationToUser({
      user_id: userId,
      title: 'رصيد منخفض ⚠️',
      body: `رصيد محفظتك منخفض: ${balance} شيكل. قم بشحن محفظتك الآن`,
      data: {
        type: 'low_balance',
        balance: balance,
        action: 'charge_wallet'
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'high'
    });
  } catch (error) {
    console.error('Error sending low balance notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار عمولة مكتسبة
 * @param {string} userId - معرف المستخدم
 * @param {number} commission - مبلغ العمولة
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendCommissionEarnedNotification = async (userId, commission, orderId) => {
  try {
    return await sendNotificationToUser({
      user_id: userId,
      title: 'عمولة جديدة! 💵',
      body: `حصلت على عمولة ${commission} شيكل من طلب`,
      data: {
        type: 'commission_earned',
        commission: commission,
        order_id: orderId,
        action: 'view_earnings'
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'normal'
    });
  } catch (error) {
    console.error('Error sending commission earned notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار ترويجي
 * @param {Object} promotionData - بيانات العرض الترويجي
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendPromotionalNotification = async (promotionData) => {
  try {
    const targetFunction = promotionData.target_type === 'all' 
      ? sendNotificationToAll 
      : promotionData.target_type === 'topic'
      ? sendNotificationToTopic
      : sendNotificationToUser;
    
    return await targetFunction({
      ...promotionData,
      data: {
        type: 'promotion',
        promotion_id: promotionData.promotion_id,
        action: 'view_promotion',
        ...promotionData.data
      },
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      priority: 'normal'
    });
  } catch (error) {
    console.error('Error sending promotional notification:', error);
    throw error;
  }
};

/**
 * تحديث حالة تسليم الإشعار
 * @param {string} notificationId - معرف الإشعار
 * @param {string} deviceId - معرف الجهاز
 * @param {string} status - الحالة الجديدة
 * @param {string} errorMessage - رسالة الخطأ (اختياري)
 * @param {Object} responseData - بيانات الاستجابة (اختياري)
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const updateNotificationDeliveryStatus = async (
  notificationId, 
  deviceId, 
  status, 
  errorMessage = null, 
  responseData = null
) => {
  try {
    const { data, error } = await supabase.rpc(
      'update_notification_delivery_status',
      {
        p_notification_id: notificationId,
        p_device_id: deviceId,
        p_status: status,
        p_error_message: errorMessage,
        p_response_data: responseData
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating notification delivery status:', error);
    throw error;
  }
};

/**
 * إرسال إشعارات تلقائية عند إكمال الطلب
 * @param {Object} orderData - بيانات الطلب
 * @returns {Promise<Array>} - معرفات الإشعارات المرسلة
 */
export const sendOrderCompletionNotifications = async (orderData) => {
  try {
    const notifications = [];
    
    // إشعار للعميل
    if (orderData.customer?.user_id || orderData.customer?.auth_user_id) {
      const customerUserId = orderData.customer.user_id || orderData.customer.auth_user_id;
      const customerNotification = await sendOrderStatusUpdateNotification(
        customerUserId, 
        orderData, 
        'completed'
      );
      notifications.push(customerNotification);
    }
    
    // إشعار للبائع
    if (orderData.vendor?.user_id) {
      const vendorCommission = orderData.total * 0.1; // 10% عمولة افتراضية
      const vendorNotification = await sendCommissionEarnedNotification(
        orderData.vendor.user_id,
        vendorCommission,
        orderData.id
      );
      notifications.push(vendorNotification);
    }
    
    // إشعار للسائق
    if (orderData.driver?.user_id) {
      const driverCommission = orderData.delivery_fee * 0.85; // 85% من رسوم التوصيل
      const driverNotification = await sendCommissionEarnedNotification(
        orderData.driver.user_id,
        driverCommission,
        orderData.id
      );
      notifications.push(driverNotification);
    }
    
    return notifications;
  } catch (error) {
    console.error('Error sending order completion notifications:', error);
    throw error;
  }
};