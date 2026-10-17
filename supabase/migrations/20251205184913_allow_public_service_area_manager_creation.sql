/*
  # السماح للجميع بإضافة مسؤولي المناطق

  1. تغييرات الأمان
    - تحديث سياسات RLS لجدول service_area_managers
    - السماح لجميع المستخدمين (بما في ذلك غير المسجلين) بإضافة مسؤولي مناطق جدد
    - السماح لجميع المستخدمين بقراءة بيانات مسؤولي المناطق
    - السماح لجميع المستخدمين بإضافة تعيينات مناطق الخدمة
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Allow insert for admins and authenticated users" ON service_area_managers;
DROP POLICY IF EXISTS "Managers can view all managers" ON service_area_managers;
DROP POLICY IF EXISTS "Admins can view all managers" ON service_area_managers;

-- إنشاء سياسة جديدة للسماح للجميع بالقراءة
CREATE POLICY "Allow anyone to view managers"
  ON service_area_managers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- إنشاء سياسة جديدة للسماح للجميع بالإضافة
CREATE POLICY "Allow anyone to insert managers"
  ON service_area_managers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- إنشاء سياسة جديدة للسماح للجميع بالتحديث
CREATE POLICY "Allow anyone to update managers"
  ON service_area_managers
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- إنشاء سياسة جديدة للسماح للجميع بالحذف
CREATE POLICY "Allow anyone to delete managers"
  ON service_area_managers
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- تحديث سياسات جدول service_area_manager_assignments
DROP POLICY IF EXISTS "Managers can view their assignments" ON service_area_manager_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON service_area_manager_assignments;

-- السماح للجميع بقراءة التعيينات
CREATE POLICY "Allow anyone to view assignments"
  ON service_area_manager_assignments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- السماح للجميع بإضافة التعيينات
CREATE POLICY "Allow anyone to insert assignments"
  ON service_area_manager_assignments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- السماح للجميع بحذف التعيينات
CREATE POLICY "Allow anyone to delete assignments"
  ON service_area_manager_assignments
  FOR DELETE
  TO anon, authenticated
  USING (true);
