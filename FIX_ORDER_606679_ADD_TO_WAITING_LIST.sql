/*
  # إضافة الطلب 606679 إلى قائمة السائقين

  هذا الملف يساعد في:
  1. التحقق من حالة الطلب 606679
  2. إضافته إلى driver_waiting_list إذا لم يكن موجوداً
  3. التحقق من جميع الطلبات المشابهة
*/

-- =================================================================
-- الخطوة 1: التحقق من الطلب 606679
-- =================================================================

-- البحث عن الطلب
SELECT
  'orders' as table_name,
  id,
  order_number,
  status,
  vendor_id,
  total,
  created_at,
  updated_at
FROM orders
WHERE order_number LIKE '%606679%'

UNION ALL

SELECT
  'captain_orders' as table_name,
  id,
  order_number,
  status,
  NULL as vendor_id,
  delivery_fee as total,
  created_at,
  updated_at
FROM captain_orders
WHERE order_number LIKE '%606679%'

UNION ALL

SELECT
  'parcel_orders' as table_name,
  id,
  order_number,
  status,
  NULL as vendor_id,
  delivery_fee as total,
  created_at,
  updated_at
FROM parcel_orders
WHERE order_number LIKE '%606679%';

-- =================================================================
-- الخطوة 2: التحقق من وجوده في driver_waiting_list
-- =================================================================

-- للطلبات العادية
SELECT
  'orders' as table_name,
  dwl.id,
  dwl.order_id,
  o.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN orders o ON dwl.order_id = o.id
WHERE o.order_number LIKE '%606679%'

UNION ALL

-- لطلبات الكابتن
SELECT
  'captain_orders' as table_name,
  dwl.id,
  dwl.captain_order_id as order_id,
  co.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN captain_orders co ON dwl.captain_order_id = co.id
WHERE co.order_number LIKE '%606679%'

UNION ALL

-- لطلبات الطرود
SELECT
  'parcel_orders' as table_name,
  dwl.id,
  dwl.parcel_order_id as order_id,
  po.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN parcel_orders po ON dwl.parcel_order_id = po.id
WHERE po.order_number LIKE '%606679%';

-- =================================================================
-- الخطوة 3: إضافة الطلب إلى القائمة (إذا كان processing)
-- =================================================================

-- للطلبات العادية
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
WHERE order_number LIKE '%606679%'
  AND status IN ('processing', 'waiting-for-driver')
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- لطلبات الكابتن
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
WHERE order_number LIKE '%606679%'
  AND status IN ('processing', 'waiting-for-driver')
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list WHERE captain_order_id = captain_orders.id
  )
ON CONFLICT (captain_order_id) DO NOTHING;

-- لطلبات الطرود
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
WHERE order_number LIKE '%606679%'
  AND status IN ('processing', 'waiting-for-driver')
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = parcel_orders.id
  )
ON CONFLICT (parcel_order_id) DO NOTHING;

-- =================================================================
-- الخطوة 4: التحقق من النتيجة
-- =================================================================

-- للطلبات العادية
SELECT
  'تم إضافة الطلب بنجاح - orders' as message,
  dwl.id,
  o.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN orders o ON dwl.order_id = o.id
WHERE o.order_number LIKE '%606679%'

UNION ALL

-- لطلبات الكابتن
SELECT
  'تم إضافة الطلب بنجاح - captain_orders' as message,
  dwl.id,
  co.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN captain_orders co ON dwl.captain_order_id = co.id
WHERE co.order_number LIKE '%606679%'

UNION ALL

-- لطلبات الطرود
SELECT
  'تم إضافة الطلب بنجاح - parcel_orders' as message,
  dwl.id,
  po.order_number,
  dwl.status,
  dwl.total,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN parcel_orders po ON dwl.parcel_order_id = po.id
WHERE po.order_number LIKE '%606679%';

-- =================================================================
-- الخطوة 5: إضافة جميع الطلبات المشابهة (في حالة processing)
-- =================================================================

-- إضافة جميع الطلبات العادية
INSERT INTO driver_waiting_list (order_id, vendor_id, total, status, created_at)
SELECT id, vendor_id, total, 'pending', now()
FROM orders
WHERE status = 'processing'
  AND driver_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id)
ON CONFLICT (order_id) DO NOTHING;

-- إضافة جميع طلبات الكابتن
INSERT INTO driver_waiting_list (captain_order_id, vendor_id, total, status, created_at)
SELECT id, NULL, delivery_fee, 'pending', now()
FROM captain_orders
WHERE status = 'processing'
  AND driver_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE captain_order_id = captain_orders.id)
ON CONFLICT (captain_order_id) DO NOTHING;

-- إضافة جميع طلبات الطرود
INSERT INTO driver_waiting_list (
  parcel_order_id, vendor_id, total, status, created_at,
  geocoded_latitude, geocoded_longitude
)
SELECT
  id, NULL, delivery_fee, 'pending', now(),
  sender_latitude, sender_longitude
FROM parcel_orders
WHERE status = 'processing'
  AND driver_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = parcel_orders.id)
ON CONFLICT (parcel_order_id) DO NOTHING;

-- =================================================================
-- الخطوة 6: تقرير نهائي
-- =================================================================

SELECT
  'إحصائيات بعد الإضافة' as report,
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders
FROM driver_waiting_list
WHERE status = 'pending';
