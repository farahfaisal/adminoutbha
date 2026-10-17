/*
  # إصلاح سياسة الإدخال لمسؤولي المناطق

  1. تغييرات الأمان
    - تحديث سياسة INSERT لجدول service_area_managers
    - السماح للمسؤولين بإضافة مسؤولي مناطق بدون قيود على user_id
    - السماح للمستخدمين العاديين بإضافة سجلاتهم فقط
*/

-- حذف السياسة القديمة وإنشاء سياسة جديدة محسّنة
DROP POLICY IF EXISTS "Allow insert for admins and authenticated users" ON service_area_managers;

CREATE POLICY "Allow insert for admins and authenticated users"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- المسؤولون يمكنهم إضافة أي سجل
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
    OR
    -- المستخدمون العاديون يمكنهم إضافة سجلاتهم فقط
    (user_id IS NOT NULL AND auth.uid() = user_id)
  );
