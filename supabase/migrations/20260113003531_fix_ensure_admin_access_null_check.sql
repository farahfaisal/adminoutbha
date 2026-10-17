/*
  # إصلاح دالة ensure_admin_access للتعامل مع user_id فارغ

  ## التغييرات
  
  1. تحديث دالة ensure_admin_access
    - التحقق من auth.uid() قبل الإدراج
    - عدم القيام بأي شيء إذا كان auth.uid() فارغاً
  
  ## الأمان
  - الحفاظ على جميع معايير الأمان الحالية
  - منع إدخال قيم null في user_id
*/

-- تحديث دالة ensure_admin_access للتعامل مع auth.uid() الفارغ
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- التحقق من وجود user_id صالح
  IF auth.uid() IS NOT NULL THEN
    -- إضافة المستخدم الحالي إلى admin_users إذا لم يكن موجوداً
    INSERT INTO admin_users (user_id, created_at)
    VALUES (auth.uid(), now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;