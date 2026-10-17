/*
  # إنشاء جدول مسؤولي مناطق الخدمة

  1. الجداول الجديدة
    - `service_area_managers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - اسم المسؤول
      - `email` (text, unique) - البريد الإلكتروني
      - `phone` (text) - رقم الهاتف
      - `password_hash` (text) - كلمة المرور المشفرة
      - `status` (text) - الحالة (active, inactive)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `service_area_manager_assignments`
      - `id` (uuid, primary key)
      - `manager_id` (uuid, foreign key to service_area_managers)
      - `service_area_id` (uuid, foreign key to service_areas)
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على الجدولين
    - سياسات للمسؤولين لقراءة بياناتهم فقط
    - سياسات للإداريين لإدارة المسؤولين

  3. ملاحظات
    - كل مسؤول يمكن أن يدير منطقة أو أكثر
    - المسؤول يمكنه فقط رؤية الطلبات والسائقين في مناطقه
*/

-- إنشاء جدول مسؤولي مناطق الخدمة
CREATE TABLE IF NOT EXISTS service_area_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  password_hash text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء جدول ربط المسؤولين بمناطق الخدمة
CREATE TABLE IF NOT EXISTS service_area_manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES service_area_managers(id) ON DELETE CASCADE,
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(manager_id, service_area_id)
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_service_area_managers_user_id ON service_area_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_service_area_managers_email ON service_area_managers(email);
CREATE INDEX IF NOT EXISTS idx_service_area_managers_status ON service_area_managers(status);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager_id ON service_area_manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_service_area_id ON service_area_manager_assignments(service_area_id);

-- تفعيل RLS
ALTER TABLE service_area_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_area_manager_assignments ENABLE ROW LEVEL SECURITY;

-- سياسات للمسؤولين - قراءة بياناتهم الخاصة
CREATE POLICY "Service area managers can read own data"
  ON service_area_managers
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- سياسات للإداريين - قراءة جميع المسؤولين
CREATE POLICY "Admins can read all managers"
  ON service_area_managers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسات للإداريين - إضافة مسؤولين جدد
CREATE POLICY "Admins can insert managers"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسات للإداريين - تحديث المسؤولين
CREATE POLICY "Admins can update managers"
  ON service_area_managers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسات للإداريين - حذف المسؤولين
CREATE POLICY "Admins can delete managers"
  ON service_area_managers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- سياسات لجدول الربط - قراءة المناطق المسندة
CREATE POLICY "Managers can read their assignments"
  ON service_area_manager_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_area_managers
      WHERE service_area_managers.id = manager_id
      AND service_area_managers.user_id = auth.uid()
    )
  );

-- سياسات للإداريين - إدارة التعيينات
CREATE POLICY "Admins can manage assignments"
  ON service_area_manager_assignments
  FOR ALL
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

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_service_area_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_service_area_managers_updated_at_trigger ON service_area_managers;
CREATE TRIGGER update_service_area_managers_updated_at_trigger
  BEFORE UPDATE ON service_area_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_service_area_managers_updated_at();
