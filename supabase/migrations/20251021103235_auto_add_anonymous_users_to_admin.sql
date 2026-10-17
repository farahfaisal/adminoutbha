/*
  # إضافة المستخدمين المجهولين تلقائياً كمسؤولين

  1. التغييرات
    - إنشاء trigger لإضافة أي مستخدم جديد إلى admin_users تلقائياً
    - هذا يسمح لجميع المستخدمين الذين يسجلون الدخول بإدارة الإعلانات

  2. الأمان
    - هذا حل مؤقت للسماح بإدارة الإعلانات
    - يجب تحديث نظام المصادقة لاحقاً لاستخدام email/password بدلاً من anonymous
*/

-- إنشاء دالة لإضافة المستخدم الجديد إلى admin_users
CREATE OR REPLACE FUNCTION add_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_users (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء trigger على جدول auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_user_to_admin();
