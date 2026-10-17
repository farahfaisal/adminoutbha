/*
  # إنشاء دالة لإضافة مدير نظام

  ## الوصف
  - دالة SQL آمنة لإنشاء مستخدم في Supabase Auth
  - إضافة المستخدم إلى جدول customers (للتوافق مع triggers)
  - إضافة المستخدم إلى جدول super_admins مع الصلاحيات

  ## الاستخدام
  SELECT * FROM create_super_admin_user(
    'admin@example.com',
    'StrongPassword123',
    'مدير النظام',
    '+966500000000'
  );
*/

CREATE OR REPLACE FUNCTION create_super_admin_user(
  p_email text,
  p_password text,
  p_full_name text DEFAULT 'مدير النظام',
  p_phone text DEFAULT '+000000000000'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- التحقق من المدخلات
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'البريد الإلكتروني مطلوب');
  END IF;
  
  IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  END IF;
  
  -- التحقق من عدم وجود مستخدم بنفس البريد
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'البريد الإلكتروني مستخدم مسبقاً');
  END IF;
  
  -- إنشاء UUID جديد
  v_user_id := gen_random_uuid();
  
  -- تشفير كلمة المرور
  v_encrypted_password := crypt(p_password, gen_salt('bf'));
  
  -- إضافة المستخدم إلى customers أولاً (لتجنب مشكلة referral trigger)
  INSERT INTO customers (
    id,
    user_id,
    name,
    phone,
    email,
    address,
    created_at
  ) VALUES (
    v_user_id,
    v_user_id,
    p_full_name,
    p_phone,
    lower(trim(p_email)),
    'System Admin',
    now()
  );
  
  -- إضافة المستخدم إلى auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    v_encrypted_password,
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', 'super_admin'
    ),
    jsonb_build_object(
      'role', 'super_admin',
      'full_name', p_full_name
    ),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );
  
  -- إضافة المستخدم إلى super_admins
  INSERT INTO super_admins (
    id,
    user_id,
    email,
    permissions,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    lower(trim(p_email)),
    jsonb_build_object(
      'all', true,
      'manage_users', true,
      'manage_vendors', true,
      'manage_orders', true,
      'manage_products', true,
      'manage_settings', true
    ),
    'active',
    now(),
    now()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء مدير النظام بنجاح',
    'user_id', v_user_id,
    'email', lower(trim(p_email))
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;