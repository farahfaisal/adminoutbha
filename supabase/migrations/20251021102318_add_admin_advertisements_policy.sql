/*
  # إضافة صلاحية المسؤولين لإدارة الإعلانات

  1. التغييرات
    - إضافة سياسة تسمح للمسؤولين بإدارة جميع الإعلانات (إضافة، تعديل، حذف)
    - السياسة تتحقق من وجود المستخدم في جدول admin_users أو super_admins

  2. الأمان
    - المسؤولون فقط يمكنهم إدارة جميع الإعلانات
    - البائعون لا يزال بإمكانهم إدارة إعلاناتهم الخاصة
*/

-- إضافة سياسة للمسؤولين لإدارة جميع الإعلانات
CREATE POLICY "Admins can manage all advertisements"
  ON advertisements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );
