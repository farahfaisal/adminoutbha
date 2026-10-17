/*
  # تصحيح دالة ensure_admin_access

  1. التغييرات
    - إزالة حقل email من الدالة لأنه غير موجود في جدول admin_users
*/

-- تحديث الدالة
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إضافة المستخدم الحالي إلى admin_users إذا لم يكن موجوداً
  INSERT INTO admin_users (user_id, created_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
