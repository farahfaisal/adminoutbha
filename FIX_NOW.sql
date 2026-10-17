/*
  # ✅ إصلاح فوري: تفعيل المعالجة التلقائية للطلبات

  ## المشكلة
  - الطلبات تبقى في حالة "pending" ولا تظهر للبائعين أبداً
  - السبب: المعالجة التلقائية معطّلة

  ## الحل
  1. تفعيل المعالجة التلقائية
  2. إصلاح الطلبات العالقة
  3. إضافة الطلبات إلى قائمة السائقين

  ## الاستخدام
  انسخ والصق هذا الكود كاملاً في Supabase SQL Editor واضغط Run
*/

-- ===============================================
-- 1️⃣ تفعيل المعالجة التلقائية
-- ===============================================

INSERT INTO app_settings (id, settings)
VALUES (
  1,
  jsonb_build_object(
    'orders', jsonb_build_object(
      'autoProcessing', true
    )
  )
)
ON CONFLICT (id) DO UPDATE
SET settings = jsonb_set(
  COALESCE(app_settings.settings, '{}'::jsonb),
  '{orders,autoProcessing}',
  'true'::jsonb,
  true
);

-- ===============================================
-- 2️⃣ التأكد من تفعيل جميع الـ Triggers
-- ===============================================

ALTER TABLE orders ENABLE TRIGGER ALL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'captain_orders') THEN
    ALTER TABLE captain_orders ENABLE TRIGGER ALL;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'parcel_orders') THEN
    ALTER TABLE parcel_orders ENABLE TRIGGER ALL;
  END IF;
END $$;

-- ===============================================
-- 3️⃣ إصلاح الطلبات العالقة في حالة pending
-- ===============================================

-- تحويل الطلبات العادية
UPDATE orders
SET
  status = 'processing',
  updated_at = now()
WHERE status = 'pending';

-- إضافة سجل في التاريخ
INSERT INTO order_status_history (order_id, status, note, created_at)
SELECT
  id,
  'processing',
  'تم القبول تلقائياً',
  now()
FROM orders
WHERE status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM order_status_history
    WHERE order_status_history.order_id = orders.id
      AND order_status_history.status = 'processing'
  );

-- تحويل طلبات الكابتن
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'captain_orders') THEN
    UPDATE captain_orders
    SET
      status = 'processing',
      updated_at = now(),
      status_history = COALESCE(status_history, '[]'::jsonb) ||
        jsonb_build_object(
          'status', 'processing',
          'timestamp', now(),
          'note', 'تم القبول تلقائياً'
        )
    WHERE status = 'pending';
  END IF;
END $$;

-- تحويل طلبات الطرود
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'parcel_orders') THEN
    UPDATE parcel_orders
    SET
      status = 'processing',
      updated_at = now(),
      status_history = COALESCE(status_history, '[]'::jsonb) ||
        jsonb_build_object(
          'status', 'processing',
          'timestamp', now(),
          'note', 'تم القبول تلقائياً'
        )
    WHERE status = 'pending';
  END IF;
END $$;

-- ===============================================
-- 4️⃣ إضافة الطلبات إلى قائمة السائقين
-- ===============================================

-- الطلبات العادية
INSERT INTO driver_waiting_list (
  order_id,
  vendor_id,
  total,
  status,
  created_at
)
SELECT
  id,
  vendor_id,
  total,
  'pending',
  now()
FROM orders
WHERE status = 'processing'
  AND driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- طلبات الكابتن
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'captain_orders') THEN
    INSERT INTO driver_waiting_list (
      captain_order_id,
      vendor_id,
      total,
      status,
      created_at
    )
    SELECT
      id,
      NULL,
      delivery_fee,
      'pending',
      now()
    FROM captain_orders
    WHERE status = 'processing'
      AND driver_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM driver_waiting_list WHERE captain_order_id = captain_orders.id
      )
    ON CONFLICT (captain_order_id) DO NOTHING;
  END IF;
END $$;

-- طلبات الطرود
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'parcel_orders') THEN
    INSERT INTO driver_waiting_list (
      parcel_order_id,
      vendor_id,
      total,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude
    )
    SELECT
      id,
      NULL,
      delivery_fee,
      'pending',
      now(),
      sender_latitude,
      sender_longitude
    FROM parcel_orders
    WHERE status = 'processing'
      AND driver_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = parcel_orders.id
      )
    ON CONFLICT (parcel_order_id) DO NOTHING;
  END IF;
END $$;

-- ===============================================
-- 5️⃣ التحقق من النتيجة
-- ===============================================

DO $$
DECLARE
  v_auto_processing BOOLEAN;
  v_pending_count INTEGER;
  v_processing_count INTEGER;
  v_waiting_list_count INTEGER;
BEGIN
  -- فحص المعالجة التلقائية
  SELECT (settings->'orders'->>'autoProcessing')::boolean
  INTO v_auto_processing
  FROM app_settings
  WHERE id = 1;

  -- عد الطلبات
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'processing')
  INTO v_pending_count, v_processing_count
  FROM orders;

  -- عد قائمة السائقين
  SELECT COUNT(*)
  INTO v_waiting_list_count
  FROM driver_waiting_list
  WHERE status = 'pending';

  -- النتائج
  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║       ✅ نتائج الإصلاح الفوري       ║';
  RAISE NOTICE '╚════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 المعالجة التلقائية: %',
    CASE WHEN v_auto_processing THEN 'مفعّلة ✅' ELSE 'معطّلة ❌' END;
  RAISE NOTICE '';
  RAISE NOTICE '📊 إحصائيات الطلبات:';
  RAISE NOTICE '   • طلبات في حالة pending: %', COALESCE(v_pending_count, 0);
  RAISE NOTICE '   • طلبات في حالة processing: %', COALESCE(v_processing_count, 0);
  RAISE NOTICE '   • في قائمة انتظار السائقين: %', COALESCE(v_waiting_list_count, 0);
  RAISE NOTICE '';

  IF v_auto_processing AND v_pending_count = 0 THEN
    RAISE NOTICE '✅ تم الإصلاح بنجاح!';
    RAISE NOTICE '✅ الطلبات الجديدة ستتحول تلقائياً وتظهر للبائعين والسائقين';
  ELSIF NOT v_auto_processing THEN
    RAISE NOTICE '⚠️ المعالجة التلقائية لا تزال معطلة';
    RAISE NOTICE '💡 تحقق من جدول app_settings';
  ELSIF v_pending_count > 0 THEN
    RAISE NOTICE '⚠️ لا تزال هناك طلبات في حالة pending';
    RAISE NOTICE '💡 قد تحتاج لتشغيل السكريبت مرة أخرى';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
END $$;

-- ===============================================
-- 6️⃣ عرض آخر الطلبات النشطة
-- ===============================================

SELECT
  '📦 آخر الطلبات النشطة' as title,
  order_number,
  status,
  vendor_name,
  customer_name,
  total,
  created_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id)
    THEN '✅ في قائمة السائقين'
    ELSE '❌ ليس في القائمة'
  END as driver_list_status
FROM orders
WHERE status IN ('pending', 'processing', 'waiting-for-driver')
ORDER BY created_at DESC
LIMIT 10;
