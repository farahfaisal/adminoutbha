-- =============================================
-- التحقق من الطلب ORD-211836
-- =============================================

-- 1. معلومات الطلب الأساسية
SELECT
  '1. معلومات الطلب' as section,
  id,
  order_number,
  status,
  vendor_id,
  customer_id,
  total,
  driver_id,
  created_at,
  updated_at
FROM orders
WHERE order_number = 'ORD-211836';

-- 2. هل الطلب موجود في driver_waiting_list؟
SELECT
  '2. وجود الطلب في قائمة السائقين' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM driver_waiting_list dwl
      JOIN orders o ON o.id = dwl.order_id
      WHERE o.order_number = 'ORD-211836'
    ) THEN 'نعم - موجود في القائمة ✅'
    ELSE 'لا - غير موجود في القائمة ❌'
  END as in_waiting_list;

-- 3. تفاصيل من driver_waiting_list إن وُجد
SELECT
  '3. تفاصيل من قائمة الانتظار' as section,
  dwl.id,
  dwl.order_id,
  dwl.vendor_id,
  dwl.total,
  dwl.status,
  dwl.driver_id,
  dwl.created_at,
  o.order_number
FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'ORD-211836';

-- 4. التحقق من إعدادات المعالجة التلقائية
SELECT
  '4. حالة المعالجة التلقائية' as section,
  settings->'orders'->>'autoProcessing' as auto_processing,
  CASE
    WHEN (settings->'orders'->>'autoProcessing')::boolean = true
    THEN 'مفعلة ✅'
    ELSE 'غير مفعلة ❌'
  END as status
FROM app_settings
LIMIT 1;

-- 5. التحقق من وجود الـ triggers
SELECT
  '5. الـ Triggers المفعلة' as section,
  tgname as trigger_name,
  tgenabled as enabled,
  CASE
    WHEN tgenabled = 'O' THEN 'مفعل ✅'
    WHEN tgenabled = 'D' THEN 'معطل ❌'
    ELSE 'حالة أخرى'
  END as status
FROM pg_trigger
WHERE tgname IN (
  'auto_process_order_trigger',
  'auto_add_to_waiting_list_trigger'
)
ORDER BY tgname;

-- 6. سجل حالات الطلب
SELECT
  '6. سجل حالات الطلب' as section,
  osh.status,
  osh.note,
  osh.created_at
FROM order_status_history osh
JOIN orders o ON o.id = osh.order_id
WHERE o.order_number = 'ORD-211836'
ORDER BY osh.created_at DESC;

-- 7. هل تم إنشاء الطلب قبل أو بعد تفعيل الـ triggers؟
SELECT
  '7. توقيت إنشاء الطلب مقارنة بالـ migration' as section,
  o.created_at as order_created_at,
  (SELECT MAX(created_at) FROM order_status_history WHERE order_id = o.id) as last_status_change,
  '2026-01-29 22:14:46'::timestamp as migration_date,
  CASE
    WHEN o.created_at < '2026-01-29 22:14:46'::timestamp
    THEN 'الطلب أقدم من الـ migration - يحتاج إضافة يدوية ⚠️'
    ELSE 'الطلب أحدث من الـ migration - يجب أن يُضاف تلقائياً ✅'
  END as analysis
FROM orders o
WHERE o.order_number = 'ORD-211836';

-- 8. إحصائيات - كم طلب processing غير موجود في القائمة؟
SELECT
  '8. طلبات processing غير موجودة في القائمة' as section,
  COUNT(*) as missing_orders_count
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  );

-- 9. عرض أول 5 طلبات processing غير موجودة في القائمة
SELECT
  '9. أمثلة على الطلبات المفقودة' as section,
  o.id,
  o.order_number,
  o.status,
  o.total,
  o.created_at,
  o.updated_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  )
ORDER BY o.created_at DESC
LIMIT 5;
