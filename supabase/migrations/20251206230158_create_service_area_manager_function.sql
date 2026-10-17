/*
  # إنشاء دالة SQL لإنشاء مسؤول منطقة

  1. الدالة
    - تنشئ مستخدم في auth.users
    - تنشئ سجل في service_area_managers
    - تربط المسؤول بمناطق الخدمة
  
  2. الأمان
    - تستخدم SECURITY DEFINER لتشغيلها بصلاحيات المالك
    - تتحقق من البيانات المدخلة
*/

CREATE OR REPLACE FUNCTION create_service_area_manager_with_auth(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_password TEXT,
  p_status TEXT DEFAULT 'active',
  p_service_area_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_manager_id UUID;
  v_area_id UUID;
  v_result JSON;
BEGIN
  -- التحقق من صحة البيانات
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'الرجاء إدخال الاسم';
  END IF;

  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'الرجاء إدخال البريد الإلكتروني';
  END IF;

  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  END IF;

  -- التحقق من عدم وجود البريد الإلكتروني مسبقاً
  IF EXISTS (SELECT 1 FROM service_area_managers WHERE email = p_email) THEN
    RAISE EXCEPTION 'البريد الإلكتروني مستخدم بالفعل';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'البريد الإلكتروني مستخدم بالفعل في النظام';
  END IF;

  -- إنشاء المستخدم في auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'service_area_manager'),
    jsonb_build_object('name', p_name, 'role', 'service_area_manager'),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- إنشاء سجل المسؤول
  INSERT INTO service_area_managers (
    user_id,
    name,
    email,
    phone,
    password_hash,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_name,
    p_email,
    p_phone,
    p_password,
    p_status,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_manager_id;

  -- ربط المسؤول بمناطق الخدمة
  IF array_length(p_service_area_ids, 1) > 0 THEN
    FOREACH v_area_id IN ARRAY p_service_area_ids LOOP
      INSERT INTO service_area_manager_assignments (manager_id, service_area_id)
      VALUES (v_manager_id, v_area_id);
    END LOOP;
  END IF;

  -- إرجاع النتيجة
  SELECT json_build_object(
    'success', true,
    'manager_id', v_manager_id,
    'user_id', v_user_id,
    'message', 'تم إنشاء المسؤول بنجاح'
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION create_service_area_manager_with_auth TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_area_manager_with_auth TO anon;
GRANT EXECUTE ON FUNCTION create_service_area_manager_with_auth TO service_role;
