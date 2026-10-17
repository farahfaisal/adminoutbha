import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('خطأ في إعدادات الخادم: متغيرات البيئة غير متوفرة');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { managerData, serviceAreaIds } = await req.json();

    if (!managerData.name || !managerData.email || !managerData.password_hash) {
      throw new Error('الرجاء تعبئة جميع الحقول المطلوبة');
    }

    if (managerData.password_hash.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(managerData.email)) {
      throw new Error('البريد الإلكتروني غير صحيح');
    }

    console.log('Creating user via Supabase Admin:', managerData.email);

    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: managerData.email,
      password: managerData.password_hash,
      email_confirm: true,
      user_metadata: {
        name: managerData.name,
        role: 'service_area_manager'
      }
    });

    console.log('Create user result:', { newUser, createUserError });

    if (createUserError) {
      let errorMsg = 'فشل في إنشاء المستخدم';

      if (createUserError.message) {
        if (createUserError.message.includes('already registered') ||
            createUserError.message.includes('already exists') ||
            createUserError.message.includes('User already registered')) {
          errorMsg = 'البريد الإلكتروني مستخدم بالفعل';
        } else if (createUserError.message.includes('password')) {
          errorMsg = 'كلمة المرور غير صالحة (يجب أن تكون 6 أحرف على الأقل)';
        } else if (createUserError.message.includes('email')) {
          errorMsg = 'البريد الإلكتروني غير صالح';
        } else {
          errorMsg = `خطأ: ${createUserError.message}`;
        }
      }

      throw new Error(errorMsg);
    }

    if (!newUser || !newUser.user || !newUser.user.id) {
      throw new Error('فشل في إنشاء المستخدم: لم يتم إرجاع معرف المستخدم');
    }

    console.log('User created successfully:', newUser.user.id);

    const { data: result, error: functionError } = await supabaseAdmin
      .rpc('create_service_area_manager_with_auth', {
        p_user_id: newUser.user.id,
        p_name: managerData.name,
        p_email: managerData.email,
        p_phone: managerData.phone || null,
        p_password: managerData.password_hash,
        p_status: managerData.status || 'active',
        p_service_area_ids: serviceAreaIds || []
      });

    console.log('Function result:', result);

    if (functionError) {
      console.error('Function error:', functionError);

      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup user:', cleanupError);
      }

      throw new Error(functionError.message);
    }

    if (!result || !result.success) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup user:', cleanupError);
      }

      throw new Error(result?.error || 'فشل في إنشاء المسؤول');
    }

    const { data: manager } = await supabaseAdmin
      .from('service_area_managers')
      .select(`
        *,
        assignments:service_area_manager_assignments(
          id,
          service_area_id,
          service_area:service_areas(id, name)
        )
      `)
      .eq('id', result.manager_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        manager: manager
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});