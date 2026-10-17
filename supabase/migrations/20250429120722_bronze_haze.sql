/*
  # إضافة دالة للتحقق من كلمة المرور بشكل مباشر

  1. التغييرات
    - تحديث دالة verify_password لتعمل مع اسم المستخدم أو البريد الإلكتروني
    - إضافة دالة للتحقق من كلمة المرور بشكل مباشر
*/

-- تحديث دالة التحقق من كلمة المرور لتعمل مع اسم المستخدم أو البريد الإلكتروني
CREATE OR REPLACE FUNCTION verify_password(username text, password text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
  user_exists boolean;
BEGIN
  -- التحقق من وجود المستخدم باستخدام اسم المستخدم
  SELECT EXISTS (
    SELECT 1 FROM custom_users
    WHERE custom_users.username = verify_password.username
  ) INTO user_exists;
  
  -- إذا لم يتم العثور على المستخدم باستخدام اسم المستخدم، حاول باستخدام البريد الإلكتروني
  IF NOT user_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.email = verify_password.username
    ) INTO user_exists;
    
    IF NOT user_exists THEN
      RETURN false;
    END IF;
    
    -- الحصول على كلمة المرور المشفرة باستخدام البريد الإلكتروني
    SELECT password_hash INTO stored_hash
    FROM custom_users
    WHERE custom_users.email = verify_password.username;
  ELSE
    -- الحصول على كلمة المرور المشفرة باستخدام اسم المستخدم
    SELECT password_hash INTO stored_hash
    FROM custom_users
    WHERE custom_users.username = verify_password.username;
  END IF;
  
  -- التحقق من كلمة المرور
  RETURN stored_hash = encode(sha256(password::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إضافة دالة للتحقق من كلمة المرور بشكل مباشر
CREATE OR REPLACE FUNCTION direct_login(username text, password text)
RETURNS jsonb AS $$
DECLARE
  user_data jsonb;
  is_valid boolean;
BEGIN
  -- التحقق من صحة كلمة المرور
  SELECT verify_password(username, password) INTO is_valid;
  
  -- إذا كانت كلمة المرور غير صحيحة، أرجع خطأ
  IF NOT is_valid THEN
    RETURN jsonb_build_object('success', false, 'message', 'بيانات الدخول غير صحيحة');
  END IF;
  
  -- الحصول على بيانات المستخدم
  SELECT row_to_json(u)::jsonb INTO user_data
  FROM (
    SELECT * FROM custom_users
    WHERE username = direct_login.username OR email = direct_login.username
  ) u;
  
  -- إذا كان المستخدم غير نشط، أرجع خطأ
  IF (user_data->>'status')::text != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'الحساب غير نشط');
  END IF;
  
  -- تحديث آخر تسجيل دخول
  UPDATE custom_users
  SET last_login = now()
  WHERE username = direct_login.username OR email = direct_login.username;
  
  -- إرجاع بيانات المستخدم
  RETURN jsonb_build_object('success', true, 'user', user_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إضافة عمود last_login إذا لم يكن موجودًا
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'custom_users' 
    AND column_name = 'last_login'
  ) THEN
    ALTER TABLE custom_users ADD COLUMN last_login timestamptz;
  END IF;
END
$$;

-- إضافة مستخدمين افتراضيين للتجربة إذا لم يكونوا موجودين
DO $$
BEGIN
  -- إضافة مستخدم مدير
  IF NOT EXISTS (SELECT 1 FROM custom_users WHERE username = 'admin') THEN
    PERFORM add_custom_user(
      'admin',
      'admin123',
      'مدير النظام',
      'admin@example.com',
      '0599123456',
      'admin'
    );
  END IF;
  
  -- إضافة مستخدم بائع
  IF NOT EXISTS (SELECT 1 FROM custom_users WHERE username = 'vendor') THEN
    PERFORM add_custom_user(
      'vendor',
      'vendor123',
      'متجر كوفي',
      'vendor@example.com',
      '0599234567',
      'vendor'
    );
  END IF;
  
  -- إضافة مستخدم سائق
  IF NOT EXISTS (SELECT 1 FROM custom_users WHERE username = 'driver') THEN
    PERFORM add_custom_user(
      'driver',
      'driver123',
      'خالد أحمد',
      'driver@example.com',
      '0599345678',
      'driver'
    );
  END IF;
END
$$;