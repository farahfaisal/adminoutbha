import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateSuperAdminRequest {
  email: string;
  password: string;
  permissions?: Record<string, any>;
  full_name?: string;
  phone?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestData: CreateSuperAdminRequest = await req.json();
    const { email, password, permissions, full_name, phone } = requestData;

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'البريد الإلكتروني وكلمة المرور مطلوبان',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // إنشاء المستخدم في Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'super_admin',
        full_name: full_name || 'مدير النظام',
      },
    });

    if (authError) {
      console.error('خطأ في إنشاء المستخدم:', authError);
      return new Response(
        JSON.stringify({
          success: false,
          error: authError.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authData.user.id;

    try {
      // إضافة المستخدم إلى جدول customers (لتجنب مشكلة referral code trigger)
      const { error: customerError } = await supabaseAdmin
        .from('customers')
        .insert({
          id: userId,
          user_id: userId,
          name: full_name || 'مدير النظام',
          phone: phone || '+000000000000',
          email: email,
          address: 'System Admin',
          created_at: new Date().toISOString(),
        });

      if (customerError) {
        console.error('تحذير: فشل إضافة customer:', customerError.message);
      }

      // إضافة المستخدم إلى جدول super_admins
      const { data: superAdminData, error: superAdminError } = await supabaseAdmin
        .from('super_admins')
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          email: email,
          permissions: permissions || {
            all: true,
            manage_users: true,
            manage_vendors: true,
            manage_orders: true,
            manage_products: true,
            manage_settings: true,
          },
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (superAdminError) {
        console.error('خطأ في إضافة المستخدم إلى super_admins:', superAdminError);
        
        // حذف المستخدم من Auth إذا فشل إضافته إلى super_admins
        await supabaseAdmin.auth.admin.deleteUser(userId);
        
        // حذف من customers إذا تم إضافته
        await supabaseAdmin.from('customers').delete().eq('id', userId);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: superAdminError.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'تم إنشاء مدير النظام بنجاح',
          data: {
            user_id: userId,
            email: email,
            permissions: superAdminData.permissions,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (innerError) {
      // حذف المستخدم من Auth في حالة فشل أي عملية
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw innerError;
    }
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'حدث خطأ غير متوقع',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});