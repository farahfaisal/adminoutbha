/*
  # إصلاح سياسات RLS لجدول مسؤولي المناطق

  1. التغييرات
    - حذف السياسات القديمة
    - إنشاء سياسات جديدة مع استخدام authenticated بدلاً من public
    - إضافة سياسات للمستخدمين المجهولين (anon) للإداريين

  2. الأمان
    - الإداريون يمكنهم إدارة جميع المسؤولين
    - المسؤولون يمكنهم قراءة بياناتهم فقط
*/

-- حذف جميع السياسات القديمة
DROP POLICY IF EXISTS "Service area managers can read own data" ON service_area_managers;
DROP POLICY IF EXISTS "Admins can read all managers" ON service_area_managers;
DROP POLICY IF EXISTS "Admins can insert managers" ON service_area_managers;
DROP POLICY IF EXISTS "Admins can update managers" ON service_area_managers;
DROP POLICY IF EXISTS "Admins can delete managers" ON service_area_managers;

-- سياسة للقراءة - الإداريون والمسؤولون
CREATE POLICY "Allow read for admins and own data"
  ON service_area_managers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- سياسة للإضافة - الإداريون فقط
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

-- سياسة للتحديث - الإداريون فقط
CREATE POLICY "Allow update for admins"
  ON service_area_managers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسة للحذف - الإداريون فقط
CREATE POLICY "Allow delete for admins"
  ON service_area_managers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسات لجدول التعيينات
DROP POLICY IF EXISTS "Managers can read their assignments" ON service_area_manager_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments" ON service_area_manager_assignments;

CREATE POLICY "Allow read assignments for admins and managers"
  ON service_area_manager_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM service_area_managers
      WHERE service_area_managers.id = manager_id
      AND service_area_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert assignments for admins"
  ON service_area_manager_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow update assignments for admins"
  ON service_area_manager_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete assignments for admins"
  ON service_area_manager_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
