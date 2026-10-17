/*
  # تحديث دالة إنشاء مسؤول منطقة

  1. التغييرات
    - إزالة استخدام pgcrypto وتشفير كلمة المرور
    - تخزين كلمة المرور كما هي (سيتم تشفيرها من Edge Function)
    - تبسيط عملية الإنشاء
*/

DROP FUNCTION IF EXISTS create_service_area_manager_with_auth;

CREATE OR REPLACE FUNCTION create_service_area_manager_with_auth(
  p_user_id UUID,
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

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'معرف المستخدم مطلوب';
  END IF;

  -- التحقق من عدم وجود البريد الإلكتروني مسبقاً
  IF EXISTS (SELECT 1 FROM service_area_managers WHERE email = p_email) THEN
    RAISE EXCEPTION 'البريد الإلكتروني مستخدم بالفعل';
  END IF;

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
    p_user_id,
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
      VALUES (v_manager_id, v_area_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- إرجاع النتيجة
  SELECT json_build_object(
    'success', true,
    'manager_id', v_manager_id,
    'user_id', p_user_id,
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
