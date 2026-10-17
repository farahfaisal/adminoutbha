/*
  # تفعيل RLS على جدول super_admins

  ## المشكلة
  - RLS غير مفعل على جدول super_admins
  - هذا يمنع Edge Function من إضافة مستخدمين جدد
  - الـ policies موجودة لكنها لا تعمل

  ## الحل
  1. تفعيل RLS
  2. إضافة policy للسماح بالإدخال من service role
  3. تحديث policies الموجودة
*/

-- تفعيل RLS على جدول super_admins
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- حذف policies القديمة
DROP POLICY IF EXISTS "Super admins can view their own data" ON super_admins;
DROP POLICY IF EXISTS "Super admins can update their own data" ON super_admins;
DROP POLICY IF EXISTS "Only super admins can manage super admins" ON super_admins;

-- السماح بالقراءة للمستخدمين المصادق عليهم من super_admins
CREATE POLICY "Super admins can view all super admin data"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
    )
  );

-- السماح بالإدخال من service role فقط
CREATE POLICY "Service role can insert super admins"
  ON super_admins
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- السماح للمدراء بإنشاء مدراء جدد
CREATE POLICY "Super admins can create new super admins"
  ON super_admins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
      AND (sa.permissions->>'all')::boolean = true
    )
  );

-- السماح بالتحديث للمستخدم نفسه أو المدراء الآخرين
CREATE POLICY "Super admins can update super admin data"
  ON super_admins
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
      AND (sa.permissions->>'all')::boolean = true
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
      AND (sa.permissions->>'all')::boolean = true
    )
  );

-- السماح بالحذف للمدراء فقط
CREATE POLICY "Super admins can delete super admins"
  ON super_admins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
      AND (sa.permissions->>'all')::boolean = true
    )
  );