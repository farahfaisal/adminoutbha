-- ==========================================
-- فحص الطلب ORD-617236
-- ==========================================

SELECT
  id,
  order_number,
  status,
  total,
  customer_id,
  vendor_id,
  driver_id,
  created_at,
  updated_at
FROM orders
WHERE order_number = 'ORD-617236';

-- ==========================================
-- فحص policies المديرين على جدول orders
-- ==========================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

-- ==========================================
-- فحص وجود المستخدم الحالي في admin_users
-- ==========================================

SELECT
  id,
  user_id,
  email,
  username,
  created_at
FROM admin_users
WHERE user_id = auth.uid();

-- ==========================================
-- إضافة policies المديرين إذا لم تكن موجودة
-- ==========================================

-- حذف policies القديمة
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- إضافة policies جديدة للمديرين
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
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
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ==========================================
-- تفعيل Realtime على جدول orders
-- ==========================================

-- التحقق من أن Realtime مفعّل
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ==========================================
-- إضافة المستخدم الحالي كمدير إذا لم يكن موجوداً
-- ==========================================

INSERT INTO admin_users (user_id, email, username, created_at)
VALUES (auth.uid(), 'admin@system.local', 'Admin', now())
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- التحقق النهائي
-- ==========================================

-- عرض جميع الطلبات المعلقة والقيد التحضير
SELECT
  order_number,
  status,
  total,
  created_at
FROM orders
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC
LIMIT 10;

-- عرض policies بعد التطبيق
SELECT
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'orders' AND policyname LIKE '%Admin%'
ORDER BY policyname;
