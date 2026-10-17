/*
  # إضافة عمود كلمة المرور للمستخدمين المخصصين

  1. التغييرات
    - إضافة عمود password للمستخدمين المخصصين
    - إنشاء دالة لتغيير كلمة المرور مباشرة من قاعدة البيانات
*/

-- إضافة عمود password إذا لم يكن موجودًا
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'custom_users' 
    AND column_name = 'password'
  ) THEN
    ALTER TABLE custom_users ADD COLUMN password text;
  END IF;
END
$$;

-- إنشاء دالة لتغيير كلمة المرور مباشرة
CREATE OR REPLACE FUNCTION change_custom_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS boolean AS $$
BEGIN
  -- تحديث كلمة المرور وتشفيرها
  UPDATE custom_users
  SET 
    password = p_new_password,
    password_hash = hash_password(p_new_password),
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة لتغيير كلمة المرور باستخدام اسم المستخدم
CREATE OR REPLACE FUNCTION change_custom_user_password_by_username(
  p_username text,
  p_new_password text
)
RETURNS boolean AS $$
BEGIN
  -- تحديث كلمة المرور وتشفيرها
  UPDATE custom_users
  SET 
    password = p_new_password,
    password_hash = hash_password(p_new_password),
    updated_at = now()
  WHERE username = p_username;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث دالة إضافة مستخدم مخصص لتخزين كلمة المرور
CREATE OR REPLACE FUNCTION add_custom_user(
  p_username text,
  p_password text,
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'customer'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- التحقق من وجود اسم المستخدم
  IF EXISTS (SELECT 1 FROM custom_users WHERE username = p_username) THEN
    RAISE EXCEPTION 'اسم المستخدم موجود بالفعل';
  END IF;
  
  -- التحقق من وجود البريد الإلكتروني (إذا تم توفيره)
  IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM custom_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'البريد الإلكتروني موجود بالفعل';
  END IF;
  
  -- إدراج المستخدم الجديد
  INSERT INTO custom_users (
    username,
    password,
    password_hash,
    name,
    email,
    phone,
    role,
    status
  ) VALUES (
    p_username,
    p_password,
    hash_password(p_password),
    p_name,
    p_email,
    p_phone,
    p_role,
    'active'
  ) RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;