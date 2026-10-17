/*
  # تحديث سياسة الإدراج لمسؤولي المناطق

  1. التغييرات
    - تعديل سياسة INSERT للسماح للمسؤولين بإضافة مدراء مناطق جدد
    - جعل user_id اختياري (nullable)
*/

-- جعل user_id اختياري
ALTER TABLE service_area_managers 
ALTER COLUMN user_id DROP NOT NULL;

-- حذف السياسة القديمة وإنشاء واحدة جديدة
DROP POLICY IF EXISTS "Allow insert for admins and self" ON service_area_managers;

CREATE POLICY "Allow insert for admins"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- إضافة سياسة للسماح للمستخدمين بإدراج بياناتهم الخاصة عند التسجيل
CREATE POLICY "Allow insert own data"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
