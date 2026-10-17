-- ============================================================
-- فحص وإصلاح الطلب ORD-617236
-- ============================================================

-- الخطوة 1: فحص حالة الطلب ORD-617236
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

-- ============================================================
-- إصلاح policies المديرين على جدول orders
-- ============================================================

-- حذف policies القديمة إذا كانت موجودة
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- إنشاء policies جديدة للمديرين
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

-- ============================================================
-- تفعيل Realtime على جدول orders
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS orders;

-- ============================================================
-- فحص policies على جدول orders
-- ============================================================

SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

-- ============================================================
-- فحص notification_settings للمستخدم الحالي
-- ============================================================

SELECT
  user_id,
  sound_enabled,
  browser_notifications_enabled,
  continuous_sound_enabled,
  auto_notifications_enabled,
  sound_repeat_interval_seconds
FROM notification_settings
WHERE user_id = auth.uid();

-- إذا لم توجد إعدادات، أنشئها بالقيم الافتراضية
INSERT INTO notification_settings (
  user_id,
  sound_enabled,
  browser_notifications_enabled,
  continuous_sound_enabled,
  auto_notifications_enabled,
  sound_repeat_interval_seconds
)
VALUES (
  auth.uid(),
  true,
  true,
  true,
  true,
  30
)
ON CONFLICT (user_id) DO UPDATE SET
  sound_enabled = true,
  continuous_sound_enabled = true,
  browser_notifications_enabled = true;

-- ============================================================
-- فحص وجود المستخدم الحالي في admin_users
-- ============================================================

SELECT
  id,
  user_id,
  email,
  username,
  role,
  created_at
FROM admin_users
WHERE user_id = auth.uid();

-- إذا لم يكن موجوداً، أضف المستخدم كمدير
INSERT INTO admin_users (user_id, email, username, role, created_at)
VALUES (auth.uid(), 'admin@system.local', 'Admin', 'admin', now())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- عرض جميع الطلبات المعلقة والقيد التحضير
-- ============================================================

SELECT
  order_number,
  status,
  total,
  customer_id,
  vendor_id,
  created_at
FROM orders
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- فحص أن Realtime مفعّل على orders
-- ============================================================

SELECT
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE tablename = 'orders';

-- ============================================================
-- اختبار إنشاء طلب جديد للتأكد من عمل التنبيهات
-- ============================================================

-- احذف هذا التعليق وقم بتشغيل الأمر التالي لاختبار:
/*
INSERT INTO orders (
  customer_id,
  vendor_id,
  status,
  total,
  delivery_address,
  order_number
)
VALUES (
  (SELECT id FROM customers LIMIT 1),
  (SELECT id FROM vendors LIMIT 1),
  'pending',
  100.00,
  'عنوان تجريبي للاختبار',
  'ORD-TEST-' || FLOOR(RANDOM() * 1000000)
);
*/

-- ============================================================
-- خلاصة التحقق
-- ============================================================

DO $$
DECLARE
  admin_count INT;
  policies_count INT;
  settings_count INT;
  realtime_count INT;
BEGIN
  -- التحقق من admin_users
  SELECT COUNT(*) INTO admin_count FROM admin_users WHERE user_id = auth.uid();

  -- التحقق من policies
  SELECT COUNT(*) INTO policies_count FROM pg_policies WHERE tablename = 'orders' AND policyname LIKE '%Admin%';

  -- التحقق من notification_settings
  SELECT COUNT(*) INTO settings_count FROM notification_settings WHERE user_id = auth.uid();

  -- التحقق من Realtime
  SELECT COUNT(*) INTO realtime_count FROM pg_publication_tables WHERE tablename = 'orders';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'نتائج الفحص:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'المستخدم موجود في admin_users: %', CASE WHEN admin_count > 0 THEN '✅ نعم' ELSE '❌ لا' END;
  RAISE NOTICE 'عدد policies المديرين على orders: %', policies_count;
  RAISE NOTICE 'إعدادات الإشعارات موجودة: %', CASE WHEN settings_count > 0 THEN '✅ نعم' ELSE '❌ لا' END;
  RAISE NOTICE 'Realtime مفعّل على orders: %', CASE WHEN realtime_count > 0 THEN '✅ نعم' ELSE '❌ لا' END;
  RAISE NOTICE '========================================';

  IF admin_count = 0 THEN
    RAISE NOTICE 'تحذير: المستخدم غير موجود في admin_users!';
  END IF;

  IF policies_count < 4 THEN
    RAISE NOTICE 'تحذير: policies المديرين غير كاملة! (متوقع 4، موجود %)!', policies_count;
  END IF;

  IF settings_count = 0 THEN
    RAISE NOTICE 'تحذير: إعدادات الإشعارات غير موجودة!';
  END IF;

  IF realtime_count = 0 THEN
    RAISE NOTICE 'تحذير: Realtime غير مفعّل على جدول orders!';
  END IF;
END $$;
