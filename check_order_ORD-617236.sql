-- =============================================
-- التحقق من الطلب ORD-617236
-- المشكلة: الطلب معلق ولم يتم الحصول على إشعار
-- =============================================

-- 1. معلومات الطلب الأساسية
SELECT
  '=== 1. معلومات الطلب الأساسية ===' as section;

SELECT
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
WHERE order_number = 'ORD-617236';

-- 2. التحقق من الحالة الحالية
SELECT
  '=== 2. الحالة الحالية ===' as section;

SELECT
  CASE
    WHEN status = 'pending' THEN '✅ pending - يجب أن يظهر إشعار'
    WHEN status = 'processing' THEN '⚠️ processing - يجب أن يكون في قائمة السائقين'
    WHEN status = 'confirmed' THEN 'ℹ️ confirmed - تم تأكيده'
    ELSE '❓ حالة أخرى: ' || status
  END as status_analysis,
  status as current_status
FROM orders
WHERE order_number = 'ORD-617236';

-- 3. سجل تغيير الحالات
SELECT
  '=== 3. سجل تغيير الحالات ===' as section;

SELECT
  osh.status,
  osh.note,
  osh.created_at,
  CASE
    WHEN osh.status = 'pending' THEN '📋 معلق'
    WHEN osh.status = 'processing' THEN '⚙️ قيد المعالجة'
    WHEN osh.status = 'confirmed' THEN '✅ مؤكد'
    WHEN osh.status = 'on_the_way' THEN '🚗 في الطريق'
    WHEN osh.status = 'delivered' THEN '✅ تم التوصيل'
    ELSE osh.status
  END as status_label
FROM order_status_history osh
JOIN orders o ON o.id = osh.order_id
WHERE o.order_number = 'ORD-617236'
ORDER BY osh.created_at DESC;

-- 4. هل الطلب موجود في قائمة السائقين؟
SELECT
  '=== 4. التحقق من قائمة انتظار السائقين ===' as section;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM driver_waiting_list dwl
      JOIN orders o ON o.id = dwl.order_id
      WHERE o.order_number = 'ORD-617236'
    ) THEN '✅ نعم - موجود في قائمة السائقين'
    ELSE '❌ لا - غير موجود في قائمة السائقين'
  END as in_waiting_list;

-- 5. تفاصيل من قائمة السائقين (إن وجد)
SELECT
  '=== 5. تفاصيل من قائمة السائقين ===' as section;

SELECT
  dwl.id,
  dwl.order_id,
  dwl.order_type,
  dwl.vendor_id,
  dwl.total,
  dwl.status,
  dwl.driver_id,
  dwl.service_area_id,
  dwl.created_at,
  o.order_number
FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'ORD-617236';

-- 6. التحقق من إعدادات الإشعارات للمستخدم
SELECT
  '=== 6. إعدادات الإشعارات ===' as section;

SELECT
  ns.sound_enabled,
  ns.browser_notifications_enabled,
  ns.continuous_sound_enabled,
  ns.sound_repeat_interval_seconds,
  ns.auto_notifications_enabled,
  CASE
    WHEN ns.sound_enabled AND ns.browser_notifications_enabled
    THEN '✅ الإشعارات مفعلة'
    WHEN NOT ns.sound_enabled
    THEN '⚠️ الصوت معطل'
    WHEN NOT ns.browser_notifications_enabled
    THEN '⚠️ إشعارات المتصفح معطلة'
    ELSE '❓ حالة غير متوقعة'
  END as notification_status
FROM notification_settings ns
JOIN orders o ON o.customer_id = ns.user_id
WHERE o.order_number = 'ORD-617236'
LIMIT 1;

-- 7. التحقق من المعالجة التلقائية
SELECT
  '=== 7. المعالجة التلقائية ===' as section;

SELECT
  settings->'orders'->>'autoProcessing' as auto_processing_enabled,
  CASE
    WHEN (settings->'orders'->>'autoProcessing')::boolean = true
    THEN '✅ المعالجة التلقائية مفعلة'
    ELSE '❌ المعالجة التلقائية معطلة'
  END as status
FROM app_settings
LIMIT 1;

-- 8. التحقق من الـ triggers
SELECT
  '=== 8. حالة الـ Triggers ===' as section;

SELECT
  tgname as trigger_name,
  CASE
    WHEN tgenabled = 'O' THEN '✅ مفعل'
    WHEN tgenabled = 'D' THEN '❌ معطل'
    ELSE '❓ حالة أخرى: ' || tgenabled
  END as status
FROM pg_trigger
WHERE tgname IN (
  'auto_process_order_trigger',
  'add_to_waiting_list_on_processing',
  'auto_add_to_waiting_list_trigger'
)
ORDER BY tgname;

-- 9. متى تم إنشاء الطلب؟
SELECT
  '=== 9. توقيت إنشاء الطلب ===' as section;

SELECT
  o.created_at,
  NOW() - o.created_at as age,
  CASE
    WHEN NOW() - o.created_at < INTERVAL '5 minutes'
    THEN '🆕 طلب جديد (أقل من 5 دقائق)'
    WHEN NOW() - o.created_at < INTERVAL '30 minutes'
    THEN '⏰ طلب حديث (أقل من 30 دقيقة)'
    WHEN NOW() - o.created_at < INTERVAL '1 hour'
    THEN '⚠️ طلب قديم نسبياً (أقل من ساعة)'
    ELSE '⚠️ طلب قديم (أكثر من ساعة)'
  END as age_analysis
FROM orders o
WHERE o.order_number = 'ORD-617236';

-- 10. إحصائيات - كم طلب pending لا تظهر إشعاراتها؟
SELECT
  '=== 10. إحصائيات الطلبات المعلقة ===' as section;

SELECT
  COUNT(*) as total_pending_orders,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as recent_pending
FROM orders
WHERE status = 'pending';

-- 11. عرض أحدث 5 طلبات معلقة
SELECT
  '=== 11. أحدث الطلبات المعلقة ===' as section;

SELECT
  order_number,
  status,
  total,
  created_at,
  NOW() - created_at as age
FROM orders
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- 12. التحقق من captain_orders و parcel_orders
SELECT
  '=== 12. التحقق من أنواع الطلبات الأخرى ===' as section;

SELECT
  'captain_orders' as table_name,
  COUNT(*) as pending_count
FROM captain_orders
WHERE status = 'pending'
UNION ALL
SELECT
  'parcel_orders' as table_name,
  COUNT(*) as pending_count
FROM parcel_orders
WHERE status = 'pending'
UNION ALL
SELECT
  'orders' as table_name,
  COUNT(*) as pending_count
FROM orders
WHERE status = 'pending';

-- =============================================
-- التوصيات
-- =============================================

SELECT
  '=== التوصيات ===' as section;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM orders WHERE order_number = 'ORD-617236' AND status = 'pending')
    THEN '
    📋 الطلب في حالة pending:

    1. ✅ تحقق من إعدادات الإشعارات في: /admin-dashboard/notification-settings
    2. ✅ تأكد من تفعيل "الإشعارات الصوتية"
    3. ✅ تأكد من تفعيل "إشعارات المتصفح"
    4. ✅ اضغط على زر "تفعيل الإشعارات الصوتية" عند ظهور التنبيه
    5. ✅ أعد تحميل الصفحة (F5) وجرب مرة أخرى
    6. ✅ تحقق من عدم كتم صوت المتصفح
    '
    WHEN EXISTS (SELECT 1 FROM orders WHERE order_number = 'ORD-617236' AND status = 'processing')
    THEN '
    ⚙️ الطلب في حالة processing:

    1. ✅ يجب أن يكون في قائمة السائقين
    2. ✅ إذا لم يكن موجوداً، نفذ:
       INSERT INTO driver_waiting_list (order_id, order_type, vendor_id, total, status)
       SELECT id, ''product'', vendor_id, total, status
       FROM orders
       WHERE order_number = ''ORD-617236'';
    '
    ELSE '
    ❓ الطلب في حالة أخرى - راجع سجل الحالات أعلاه
    '
  END as recommendations;
