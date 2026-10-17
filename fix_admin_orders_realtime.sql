/*
  # إصلاح مشكلة التنبيهات للمديرين

  ## المشكلة
  - المديرين لا يحصلون على تنبيهات للطلبات الجديدة
  - الاشتراكات (Realtime) لا تعمل بسبب عدم وجود policies صريحة للمديرين على جدول orders

  ## الحل
  - إضافة policies للمديرين على جدول orders
  - السماح للمديرين برؤية جميع الطلبات (pending, processing, وجميع الحالات)

  ## كيفية التطبيق
  1. افتح Supabase Dashboard
  2. اذهب إلى SQL Editor
  3. الصق هذا السكريبت وشغّله
*/

-- =====================================================
-- إضافة صلاحيات المديرين على جدول orders
-- =====================================================

-- حذف الـ policies القديمة إذا كانت موجودة
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- إضافة policies جديدة للمديرين
CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders
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

CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- =====================================================
-- التحقق من أن المستخدم موجود في admin_users
-- =====================================================

-- يمكنك التحقق من وجودك في جدول admin_users بهذا الاستعلام:
-- SELECT * FROM admin_users WHERE user_id = auth.uid();

-- إذا لم تكن موجوداً، يمكنك إضافة نفسك بهذا الأمر:
-- INSERT INTO admin_users (user_id, email, username, created_at)
-- VALUES (auth.uid(), 'admin@example.com', 'Admin', now())
-- ON CONFLICT (user_id) DO NOTHING;
