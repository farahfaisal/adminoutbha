/*
  # إصلاح عمود آخر تسجيل دخول في دالة التحقق

  ## التغييرات
  
  1. تحديث دالة verify_admin_password
    - استخدام last_login بدلاً من last_login_at
    - تطابق مع بنية جدول super_admins الفعلية
  
  ## ملاحظات
  - هذا إصلاح لخطأ في الـ migration السابق
  - العمود الصحيح هو last_login وليس last_login_at
*/

-- تحديث دالة التحقق من كلمة المرور لاستخدام اسم العمود الصحيح
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
  v_super_admin record;
  v_auth_user record;
BEGIN
  -- أولاً: البحث عن المستخدم في جدول admin_users
  SELECT * INTO v_user
  FROM admin_users
  WHERE username = lower(trim(p_username))
    AND is_active = true;
  
  IF FOUND THEN
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
  END IF;
  
  -- ثانياً: البحث عن المستخدم في جدول super_admins باستخدام البريد الإلكتروني
  SELECT * INTO v_super_admin
  FROM super_admins
  WHERE email = lower(trim(p_username))
    AND status = 'active';
  
  IF FOUND THEN
    -- البحث عن المستخدم في auth.users
    SELECT * INTO v_auth_user
    FROM auth.users
    WHERE id = v_super_admin.user_id;
    
    IF FOUND THEN
      -- تحديث آخر دخول (استخدام last_login بدلاً من last_login_at)
      UPDATE super_admins
      SET last_login = now()
      WHERE user_id = v_super_admin.user_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'user_id', v_super_admin.user_id,
        'username', v_super_admin.email,
        'full_name', COALESCE(v_auth_user.raw_user_meta_data->>'full_name', v_super_admin.email),
        'email', v_super_admin.email,
        'is_super_admin', true
      );
    END IF;
  END IF;
  
  -- إذا لم يتم العثور على المستخدم في أي من الجدولين
  RETURN jsonb_build_object(
    'success', false,
    'error', 'اسم المستخدم أو كلمة المرور غير صحيحة'
  );
END;
$$;