/*
  # إصلاح دالة إنشاء مستخدم إداري

  ## المشكلة
  - الجدول يحتوي على حقلين: id و user_id
  - الدالة كانت تدخل user_id فقط دون id
  - هذا يسبب خطأ "Database error creating new user"

  ## الحل
  - تحديث دالة create_admin_user لإدخال كلا الحقلين
  - إنشاء UUID واحد واستخدامه لكليهما
*/

-- إصلاح دالة إنشاء مستخدم جديد
CREATE OR REPLACE FUNCTION create_admin_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_password_validation jsonb;
  v_existing_user record;
BEGIN
  -- التحقق من صحة المدخلات
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'اسم المستخدم مطلوب'
    );
  END IF;
  
  IF p_password IS NULL OR trim(p_password) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كلمة المرور مطلوبة'
    );
  END IF;
  
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الاسم الكامل مطلوب'
    );
  END IF;
  
  -- التحقق من قوة كلمة المرور
  v_password_validation := validate_password_strength(p_password);
  IF NOT (v_password_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كلمة المرور ضعيفة',
      'validation', v_password_validation
    );
  END IF;
  
  -- التحقق من عدم وجود المستخدم مسبقاً
  SELECT * INTO v_existing_user
  FROM admin_users
  WHERE username = lower(trim(p_username));
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'اسم المستخدم موجود مسبقاً'
    );
  END IF;
  
  -- إنشاء UUID جديد
  v_user_id := gen_random_uuid();
  
  -- إنشاء المستخدم الجديد
  INSERT INTO admin_users (
    id,
    user_id,
    username,
    password_hash,
    full_name,
    email,
    is_active,
    created_by,
    created_at
  ) VALUES (
    v_user_id,
    v_user_id,
    lower(trim(p_username)),
    crypt(p_password, gen_salt('bf', 10)),
    trim(p_full_name),
    CASE WHEN p_email IS NOT NULL THEN lower(trim(p_email)) ELSE NULL END,
    true,
    p_created_by,
    now()
  );
  
  -- تسجيل في سجل التدقيق إذا كانت الدالة موجودة
  BEGIN
    PERFORM log_audit_event(
      p_created_by,
      'create_admin_user',
      'admin_users',
      v_user_id,
      NULL,
      jsonb_build_object(
        'username', p_username,
        'full_name', p_full_name,
        'email', p_email
      ),
      NULL,
      NULL,
      'warning'
    );
  EXCEPTION WHEN OTHERS THEN
    -- تجاهل الخطأ إذا لم تكن دالة التدقيق موجودة
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', lower(trim(p_username)),
    'message', 'تم إنشاء المستخدم بنجاح',
    'password_strength', v_password_validation->>'strength'
  );
END;
$$;

-- إصلاح دالة تفعيل/تعطيل مستخدم
CREATE OR REPLACE FUNCTION toggle_admin_user_status(
  p_username text,
  p_is_active boolean,
  p_updated_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- التحقق من وجود المستخدم
  SELECT user_id INTO v_user_id
  FROM admin_users
  WHERE username = p_username;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المستخدم غير موجود'
    );
  END IF;
  
  -- تحديث الحالة
  UPDATE admin_users
  SET is_active = p_is_active
  WHERE username = p_username;
  
  -- إنهاء جميع الجلسات إذا تم التعطيل
  IF NOT p_is_active THEN
    BEGIN
      PERFORM end_all_user_sessions(v_user_id);
    EXCEPTION WHEN OTHERS THEN
      -- تجاهل الخطأ إذا لم تكن الدالة موجودة
      NULL;
    END;
  END IF;
  
  -- تسجيل في سجل التدقيق
  BEGIN
    PERFORM log_audit_event(
      p_updated_by,
      CASE WHEN p_is_active THEN 'activate_user' ELSE 'deactivate_user' END,
      'admin_users',
      v_user_id,
      NULL,
      jsonb_build_object('username', p_username, 'is_active', p_is_active),
      NULL,
      NULL,
      'warning'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_is_active THEN 'تم تفعيل المستخدم' ELSE 'تم تعطيل المستخدم' END
  );
END;
$$;

-- إصلاح دالة حذف مستخدم
CREATE OR REPLACE FUNCTION delete_admin_user(
  p_username text,
  p_deleted_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- التحقق من عدم حذف آخر مستخدم
  IF (SELECT COUNT(*) FROM admin_users WHERE is_active = true) <= 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا يمكن حذف آخر مستخدم نشط'
    );
  END IF;
  
  -- البحث عن المستخدم
  SELECT user_id INTO v_user_id
  FROM admin_users
  WHERE username = p_username;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المستخدم غير موجود'
    );
  END IF;
  
  -- إنهاء جميع الجلسات
  BEGIN
    PERFORM end_all_user_sessions(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- حذف المستخدم
  DELETE FROM admin_users WHERE username = p_username;
  
  -- تسجيل في سجل التدقيق
  BEGIN
    PERFORM log_audit_event(
      p_deleted_by,
      'delete_admin_user',
      'admin_users',
      v_user_id,
      jsonb_build_object('username', p_username),
      NULL,
      NULL,
      NULL,
      'critical'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف المستخدم بنجاح'
  );
END;
$$;

-- إصلاح دالة تحديث كلمة المرور
CREATE OR REPLACE FUNCTION update_admin_password(
  p_username text,
  p_old_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_password_validation jsonb;
BEGIN
  -- البحث عن المستخدم
  SELECT * INTO v_user
  FROM admin_users
  WHERE username = p_username
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المستخدم غير موجود أو غير نشط'
    );
  END IF;
  
  -- التحقق من كلمة المرور القديمة
  IF v_user.password_hash IS NOT NULL THEN
    IF NOT (v_user.password_hash = crypt(p_old_password, v_user.password_hash)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'كلمة المرور القديمة غير صحيحة'
      );
    END IF;
  END IF;
  
  -- التحقق من قوة كلمة المرور الجديدة
  v_password_validation := validate_password_strength(p_new_password);
  IF NOT (v_password_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كلمة المرور الجديدة ضعيفة',
      'validation', v_password_validation
    );
  END IF;
  
  -- تحديث كلمة المرور
  UPDATE admin_users
  SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
  WHERE username = p_username;
  
  -- إنهاء جميع الجلسات النشطة
  BEGIN
    PERFORM end_all_user_sessions(v_user.user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- تسجيل في سجل التدقيق
  BEGIN
    PERFORM log_audit_event(
      v_user.user_id,
      'update_password',
      'admin_users',
      v_user.user_id,
      NULL,
      NULL,
      NULL,
      NULL,
      'warning'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث كلمة المرور بنجاح',
    'password_strength', v_password_validation->>'strength'
  );
END;
$$;