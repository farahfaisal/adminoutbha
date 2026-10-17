-- =============================================
-- إصلاح: إضافة الطلب ORD-211836 والطلبات المفقودة
-- إلى driver_waiting_list
-- =============================================

/*
  المشكلة:
  - الطلب ORD-211836 في حالة processing
  - المعالجة التلقائية تعمل (status = processing)
  - لكن الطلب لم يُضف إلى driver_waiting_list

  السبب المحتمل:
  1. الطلب أُنشئ قبل تطبيق الـ migration الذي يضيف الـ triggers
  2. أو حدث خطأ أثناء الإضافة التلقائية
  3. أو الطلب تم تحديثه يدوياً بدون المرور بالـ trigger

  الحل:
  - إضافة جميع الطلبات في حالة processing إلى driver_waiting_list
  - تجنب التكرار باستخدام ON CONFLICT DO NOTHING
*/

-- =============================================
-- الجزء 1: إضافة الطلبات العادية المفقودة
-- =============================================

INSERT INTO driver_waiting_list (
  order_id,
  vendor_id,
  total,
  status,
  created_at
)
SELECT
  o.id,
  o.vendor_id,
  COALESCE(o.total, 0) as total,
  'pending' as status,
  now() as created_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- عرض الطلبات التي تمت إضافتها
DO $$
DECLARE
  v_added_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_added_count = ROW_COUNT;
  RAISE NOTICE 'تمت إضافة % طلب عادي إلى driver_waiting_list', v_added_count;
END $$;

-- =============================================
-- الجزء 2: إضافة طلبات الكابتن المفقودة
-- =============================================

INSERT INTO driver_waiting_list (
  captain_order_id,
  vendor_id,
  total,
  status,
  created_at
)
SELECT
  co.id,
  NULL as vendor_id,
  COALESCE(co.delivery_fee, 0) as total,
  'pending' as status,
  now() as created_at
FROM captain_orders co
WHERE co.status = 'processing'
  AND co.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl
    WHERE dwl.captain_order_id = co.id
  )
ON CONFLICT (captain_order_id) DO NOTHING;

-- عرض الطلبات التي تمت إضافتها
DO $$
DECLARE
  v_added_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_added_count = ROW_COUNT;
  RAISE NOTICE 'تمت إضافة % طلب كابتن إلى driver_waiting_list', v_added_count;
END $$;

-- =============================================
-- الجزء 3: إضافة طلبات الطرود المفقودة
-- =============================================

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
  po.id,
  NULL as vendor_id,
  COALESCE(po.delivery_fee, 0) as total,
  'pending' as status,
  now() as created_at,
  po.sender_latitude,
  po.sender_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
  AND po.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl
    WHERE dwl.parcel_order_id = po.id
  )
ON CONFLICT (parcel_order_id) DO NOTHING;

-- عرض الطلبات التي تمت إضافتها
DO $$
DECLARE
  v_added_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_added_count = ROW_COUNT;
  RAISE NOTICE 'تمت إضافة % طلب طرد إلى driver_waiting_list', v_added_count;
END $$;

-- =============================================
-- الجزء 4: التحقق من إضافة الطلب ORD-211836
-- =============================================

SELECT
  'تم التحقق من الطلب ORD-211836' as status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM driver_waiting_list dwl
      JOIN orders o ON o.id = dwl.order_id
      WHERE o.order_number = 'ORD-211836'
    ) THEN 'الطلب موجود الآن في driver_waiting_list ✅'
    ELSE 'الطلب ما زال غير موجود ❌ - تحقق من حالة الطلب'
  END as result;

-- عرض تفاصيل الطلب من driver_waiting_list
SELECT
  'تفاصيل الطلب ORD-211836 في القائمة' as info,
  dwl.id as waiting_list_id,
  dwl.order_id,
  o.order_number,
  dwl.vendor_id,
  dwl.total,
  dwl.status,
  dwl.created_at as added_to_list_at,
  o.created_at as order_created_at
FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'ORD-211836';

-- =============================================
-- الجزء 5: إحصائيات نهائية
-- =============================================

-- عدد الطلبات في driver_waiting_list الآن
SELECT
  'إحصائيات driver_waiting_list' as info,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
  COUNT(CASE WHEN driver_id IS NOT NULL THEN 1 END) as assigned_orders
FROM driver_waiting_list;

-- الطلبات الأحدث في القائمة
SELECT
  'آخر 5 طلبات تمت إضافتها' as info,
  dwl.id,
  COALESCE(o.order_number, co.order_number, po.order_number) as order_number,
  CASE
    WHEN dwl.order_id IS NOT NULL THEN 'طلب عادي'
    WHEN dwl.captain_order_id IS NOT NULL THEN 'طلب كابتن'
    WHEN dwl.parcel_order_id IS NOT NULL THEN 'طلب طرد'
  END as order_type,
  dwl.total,
  dwl.status,
  dwl.created_at
FROM driver_waiting_list dwl
LEFT JOIN orders o ON o.id = dwl.order_id
LEFT JOIN captain_orders co ON co.id = dwl.captain_order_id
LEFT JOIN parcel_orders po ON po.id = dwl.parcel_order_id
ORDER BY dwl.created_at DESC
LIMIT 5;
