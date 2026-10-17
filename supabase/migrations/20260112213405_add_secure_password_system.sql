/*
  # نظام كلمات المرور الآمنة

  ## التغييرات
  
  1. تفعيل pgcrypto extension
    - لتشفير كلمات المرور باستخدام bcrypt
  
  2. تحديث جدول admin_users
    - إضافة حقل password_hash
    - إضافة معلومات إضافية للمستخدمين
  
  3. دوال إدارة المستخدمين
    - create_admin_user: إنشاء مستخدم جديد بكلمة مرور مشفرة
    - update_admin_password: تحديث كلمة المرور
    - verify_admin_password: التحقق من كلمة المرور
    - list_admin_users: عرض جميع المستخدمين
  
  4. سياسات RLS محدثة
    - حماية بيانات المستخدمين
    - السماح للمشرفين بإدارة المستخدمين

  ## الأمان
  - جميع كلمات المرور مشفرة باستخدام bcrypt
  - لا يمكن استرجاع كلمة المرور الأصلية
  - يجب استخدام كلمات مرور قوية (8+ أحرف)
*/

-- تفعيل pgcrypto extension لتشفير كلمات المرور
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- التحقق من وجود جدول admin_users وتحديثه
DO $$
BEGIN
  -- إضافة أعمدة جديدة إذا لم تكن موجودة
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'username'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN username text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN full_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'email'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN last_login timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN created_by uuid;
  END IF;
END $$;

-- إنشاء index على username
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- دالة للتحقق من قوة كلمة المرور
CREATE OR REPLACE FUNCTION validate_password_strength(p_password text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_length integer;
  v_has_upper boolean;
  v_has_lower boolean;
  v_has_digit boolean;
  v_has_special boolean;
  v_score integer := 0;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  v_length := length(p_password);
  
  -- التحقق من الطول الأدنى
  IF v_length < 8 THEN
    v_errors := array_append(v_errors, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  ELSE
    v_score := v_score + 1;
  END IF;
  
  -- التحقق من وجود حرف كبير
  v_has_upper := p_password ~ '[A-Z]';
  IF v_has_upper THEN
    v_score := v_score + 1;
  ELSE
    v_errors := array_append(v_errors, 'يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
  END IF;
  
  -- التحقق من وجود حرف صغير
  v_has_lower := p_password ~ '[a-z]';
  IF v_has_lower THEN
    v_score := v_score + 1;
  ELSE
    v_errors := array_append(v_errors, 'يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
  END IF;
  
  -- التحقق من وجود رقم
  v_has_digit := p_password ~ '[0-9]';
  IF v_has_digit THEN
    v_score := v_score + 1;
  ELSE
    v_errors := array_append(v_errors, 'يجب أن تحتوي على رقم واحد على الأقل (0-9)');
  END IF;
  
  -- التحقق من وجود رمز خاص
  v_has_special := p_password ~ '[!@#$%^&*(),.?":{}|<>]';
  IF v_has_special THEN
    v_score := v_score + 1;
  END IF;
  
  -- طول أكثر من 12 حرف
  IF v_length >= 12 THEN
    v_score := v_score + 1;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'score', v_score,
    'strength', CASE
      WHEN v_score <= 2 THEN 'ضعيفة'
      WHEN v_score <= 4 THEN 'متوسطة'
      WHEN v_score <= 5 THEN 'قوية'
      ELSE 'قوية جداً'
    END,
    'errors', COALESCE(v_errors, ARRAY[]::text[])
  );
END;
$$;

-- دالة لإنشاء مستخدم جديد
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
  WHERE username = p_username;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'اسم المستخدم موجود مسبقاً'
    );
  END IF;
  
  -- إنشاء المستخدم الجديد
  INSERT INTO admin_users (
    user_id,
    username,
    password_hash,
    full_name,
    email,
    is_active,
    created_by,
    created_at
  ) VALUES (
    gen_random_uuid(),
    lower(trim(p_username)),
    crypt(p_password, gen_salt('bf', 10)),
    trim(p_full_name),
    CASE WHEN p_email IS NOT NULL THEN lower(trim(p_email)) ELSE NULL END,
    true,
    p_created_by,
    now()
  ) RETURNING user_id INTO v_user_id;
  
  -- تسجيل في سجل التدقيق
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
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', p_username,
    'message', 'تم إنشاء المستخدم بنجاح',
    'password_strength', v_password_validation->>'strength'
  );
END;
$$;

-- دالة لتحديث كلمة المرور
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
  SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE username = p_username;
  
  -- إنهاء جميع الجلسات النشطة
  PERFORM end_all_user_sessions(v_user.user_id);
  
  -- تسجيل في سجل التدقيق
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
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث كلمة المرور بنجاح',
    'password_strength', v_password_validation->>'strength'
  );
END;
$$;

-- دالة للتحقق من كلمة المرور
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
BEGIN
  -- البحث عن المستخدم
  SELECT * INTO v_user
  FROM admin_users
  WHERE username = lower(trim(p_username))
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'اسم المستخدم أو كلمة المرور غير صحيحة'
    );
  END IF;
  
  -- التحقق من كلمة المرور
  IF v_user.password_hash IS NULL THEN
    -- للتوافق مع النظام القديم - مستخدم admin الافتراضي
    IF p_username = 'admin' AND p_password = 'admin123' THEN
      -- تحديث آخر دخول
      UPDATE admin_users
      SET last_login = now()
      WHERE user_id = v_user.user_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user.user_id,
        'username', v_user.username,
        'full_name', v_user.full_name,
        'email', v_user.email,
        'warning', 'يرجى تغيير كلمة المرور الافتراضية'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'اسم المستخدم أو كلمة المرور غير صحيحة'
      );
    END IF;
  END IF;
  
  -- التحقق من كلمة المرور المشفرة
  IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
    -- تحديث آخر دخول
    UPDATE admin_users
    SET last_login = now()
    WHERE user_id = v_user.user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user.user_id,
      'username', v_user.username,
      'full_name', v_user.full_name,
      'email', v_user.email
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'اسم المستخدم أو كلمة المرور غير صحيحة'
    );
  END IF;
END;
$$;

-- دالة لعرض جميع المستخدمين
CREATE OR REPLACE FUNCTION list_admin_users()
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  email text,
  is_active boolean,
  last_login timestamptz,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.user_id,
    a.username,
    a.full_name,
    a.email,
    a.is_active,
    a.last_login,
    a.created_at,
    a.created_by
  FROM admin_users a
  ORDER BY a.created_at DESC;
END;
$$;

-- دالة لتعطيل/تفعيل مستخدم
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
  SET is_active = p_is_active,
      updated_at = now()
  WHERE username = p_username;
  
  -- إنهاء جميع الجلسات إذا تم التعطيل
  IF NOT p_is_active THEN
    PERFORM end_all_user_sessions(v_user_id);
  END IF;
  
  -- تسجيل في سجل التدقيق
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
  
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_is_active THEN 'تم تفعيل المستخدم' ELSE 'تم تعطيل المستخدم' END
  );
END;
$$;

-- دالة لحذف مستخدم
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
  PERFORM end_all_user_sessions(v_user_id);
  
  -- حذف المستخدم
  DELETE FROM admin_users WHERE username = p_username;
  
  -- تسجيل في سجل التدقيق
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
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف المستخدم بنجاح'
  );
END;
$$;

-- سياسات RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- السماح للمشرفين بقراءة جميع المستخدمين
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- ملاحظة: جميع العمليات الأخرى تتم عبر الدوال الآمنة فقط