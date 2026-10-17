/*
  # تشخيص وحل مشكلة اختفاء الطلبات

  هذا الملف يساعد في:
  1. فحص السبب وراء اختفاء/رفض الطلبات
  2. تطبيق الحل المناسب تلقائياً
  3. التحقق من النتيجة
*/

-- =================================================================
-- الخطوة 1: تشخيص المشكلة
-- =================================================================

DO $$
DECLARE
  v_auto_processing BOOLEAN;
  v_pending_count INTEGER;
  v_triggers_status TEXT;
BEGIN
  RAISE NOTICE '=== بدء التشخيص ===';
  RAISE NOTICE '';

  -- 1. فحص إعدادات المعالجة التلقائية
  SELECT (settings->'orders'->>'autoProcessing')::boolean
  INTO v_auto_processing
  FROM app_settings
  LIMIT 1;

  RAISE NOTICE '1️⃣ حالة المعالجة التلقائية:';
  IF v_auto_processing IS TRUE THEN
    RAISE NOTICE '   ✅ مفعّلة (autoProcessing = true)';
  ELSIF v_auto_processing IS FALSE THEN
    RAISE NOTICE '   ❌ معطّلة (autoProcessing = false) - هذا هو السبب!';
  ELSE
    RAISE NOTICE '   ❌ غير محددة (NULL) - هذا هو السبب!';
  END IF;
  RAISE NOTICE '';

  -- 2. فحص عدد الطلبات العالقة في pending
  SELECT COUNT(*) INTO v_pending_count
  FROM orders
  WHERE status = 'pending';

  RAISE NOTICE '2️⃣ الطلبات العالقة في حالة pending:';
  RAISE NOTICE '   عدد الطلبات: %', v_pending_count;
  IF v_pending_count > 0 THEN
    RAISE NOTICE '   ⚠️ يوجد طلبات عالقة في حالة pending!';
  ELSE
    RAISE NOTICE '   ✅ لا توجد طلبات عالقة';
  END IF;
  RAISE NOTICE '';

  -- 3. فحص حالة الـ Triggers
  SELECT string_agg(
    tgname || ': ' ||
    CASE tgenabled
      WHEN 'O' THEN 'enabled ✅'
      WHEN 'D' THEN 'disabled ❌'
      ELSE 'unknown'
    END,
    E'\n   '
  )
  INTO v_triggers_status
  FROM pg_trigger
  WHERE tgrelid = 'orders'::regclass
    AND tgname LIKE '%auto%';

  RAISE NOTICE '3️⃣ حالة الـ Triggers:';
  RAISE NOTICE '   %', COALESCE(v_triggers_status, 'لا توجد triggers');
  RAISE NOTICE '';

  RAISE NOTICE '=== انتهى التشخيص ===';
END $$;

-- =================================================================
-- الخطوة 2: عرض الطلبات العالقة
-- =================================================================

SELECT
  '⚠️ طلبات عالقة في حالة pending' as alert,
  order_number,
  customer_name,
  vendor_name,
  total,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as age_minutes
FROM orders
WHERE status = 'pending'
ORDER BY created_at DESC;

-- =================================================================
-- الخطوة 3: تطبيق الحل التلقائي
-- =================================================================

DO $$
DECLARE
  v_auto_processing BOOLEAN;
  v_updated_count INTEGER;
  v_added_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== بدء تطبيق الحل ===';
  RAISE NOTICE '';

  -- 1. فحص حالة المعالجة التلقائية
  SELECT (settings->'orders'->>'autoProcessing')::boolean
  INTO v_auto_processing
  FROM app_settings
  LIMIT 1;

  -- 2. تفعيل المعالجة التلقائية إذا كانت معطلة
  IF v_auto_processing IS NOT TRUE THEN
    RAISE NOTICE '🔧 تفعيل المعالجة التلقائية...';

    -- إنشاء أو تحديث إعدادات المعالجة التلقائية
    INSERT INTO app_settings (id, settings)
    VALUES (
      1,
      '{"orders": {"autoProcessing": true}}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET settings = jsonb_set(
      COALESCE(app_settings.settings, '{}'::jsonb),
      '{orders,autoProcessing}',
      'true'::jsonb
    );

    RAISE NOTICE '   ✅ تم تفعيل المعالجة التلقائية';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ المعالجة التلقائية مفعّلة بالفعل';
    RAISE NOTICE '';
  END IF;

  -- 3. تفعيل الـ Triggers (إذا كانت معطلة)
  RAISE NOTICE '🔧 تفعيل الـ Triggers...';

  EXECUTE 'ALTER TABLE orders ENABLE TRIGGER auto_process_order_trigger';
  EXECUTE 'ALTER TABLE orders ENABLE TRIGGER auto_add_to_waiting_list_trigger';

  EXECUTE 'ALTER TABLE captain_orders ENABLE TRIGGER auto_process_captain_order_trigger';
  EXECUTE 'ALTER TABLE captain_orders ENABLE TRIGGER auto_add_captain_to_waiting_list_trigger';

  EXECUTE 'ALTER TABLE parcel_orders ENABLE TRIGGER auto_process_parcel_order_trigger';
  EXECUTE 'ALTER TABLE parcel_orders ENABLE TRIGGER auto_add_parcel_to_waiting_list_trigger';

  RAISE NOTICE '   ✅ تم تفعيل جميع الـ Triggers';
  RAISE NOTICE '';

  -- 4. تحويل الطلبات العالقة من pending إلى processing
  RAISE NOTICE '🔧 تحويل الطلبات العالقة من pending إلى processing...';

  -- الطلبات العادية
  WITH updated AS (
    UPDATE orders
    SET
      status = 'processing',
      updated_at = now()
    WHERE status = 'pending'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RAISE NOTICE '   📦 تم تحويل % طلب عادي', v_updated_count;

  -- إضافة سجل في order_status_history
  INSERT INTO order_status_history (order_id, status, note, created_at)
  SELECT
    id,
    'processing',
    'تم القبول تلقائياً - تحويل يدوي من pending',
    now()
  FROM orders
  WHERE status = 'processing'
    AND NOT EXISTS (
      SELECT 1 FROM order_status_history
      WHERE order_status_history.order_id = orders.id
        AND order_status_history.status = 'processing'
    );

  -- طلبات الكابتن
  UPDATE captain_orders
  SET
    status = 'processing',
    updated_at = now(),
    status_history = COALESCE(status_history, '[]'::jsonb) ||
      jsonb_build_object(
        'status', 'processing',
        'timestamp', now(),
        'note', 'تم القبول تلقائياً - تحويل يدوي من pending'
      )
  WHERE status = 'pending';

  -- طلبات الطرود
  UPDATE parcel_orders
  SET
    status = 'processing',
    updated_at = now(),
    status_history = COALESCE(status_history, '[]'::jsonb) ||
      jsonb_build_object(
        'status', 'processing',
        'timestamp', now(),
        'note', 'تم القبول تلقائياً - تحويل يدوي من pending'
      )
  WHERE status = 'pending';

  RAISE NOTICE '';

  -- 5. إضافة الطلبات إلى قائمة السائقين
  RAISE NOTICE '🔧 إضافة الطلبات إلى قائمة السائقين...';

  -- الطلبات العادية
  WITH added AS (
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
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_added_count FROM added;

  RAISE NOTICE '   🚗 تمت إضافة % طلب عادي إلى قائمة السائقين', v_added_count;

  -- طلبات الكابتن
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

  -- طلبات الطرود
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

  RAISE NOTICE '';
  RAISE NOTICE '=== اكتمل تطبيق الحل ===';
END $$;

-- =================================================================
-- الخطوة 4: التحقق من النتيجة
-- =================================================================

-- 1. فحص الإعدادات الحالية
SELECT
  'إعدادات المعالجة التلقائية' as status,
  (settings->'orders'->>'autoProcessing')::boolean as auto_processing_enabled,
  settings->'orders' as full_settings
FROM app_settings
LIMIT 1;

-- 2. فحص عدد الطلبات في كل حالة
SELECT
  'إحصائيات الطلبات' as report,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) as total_orders
FROM orders;

-- 3. فحص قائمة السائقين
SELECT
  'إحصائيات قائمة السائقين' as report,
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders,
  SUM(total) as total_value
FROM driver_waiting_list
WHERE status = 'pending';

-- 4. عرض آخر الطلبات
SELECT
  '✅ آخر الطلبات النشطة' as status,
  o.order_number,
  o.status as order_status,
  o.vendor_name,
  o.total,
  o.created_at,
  CASE
    WHEN dwl.id IS NOT NULL THEN '✅ في قائمة السائقين'
    ELSE '❌ ليس في قائمة السائقين'
  END as driver_list_status
FROM orders o
LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
WHERE o.status IN ('processing', 'pending')
ORDER BY o.created_at DESC
LIMIT 10;

-- =================================================================
-- الخطوة 5: اختبار بطلب جديد
-- =================================================================

DO $$
DECLARE
  v_test_order_id UUID;
  v_test_order_number TEXT;
  v_final_status TEXT;
  v_in_waiting_list BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== اختبار بطلب جديد ===';
  RAISE NOTICE '';

  -- إنشاء طلب تجريبي
  v_test_order_number := 'TEST-' || floor(random() * 1000000);

  INSERT INTO orders (
    order_number,
    customer_name,
    customer_phone,
    vendor_id,
    vendor_name,
    address,
    city,
    total,
    subtotal,
    delivery_fee,
    status
  ) VALUES (
    v_test_order_number,
    'زبون تجريبي',
    '0501234567',
    (SELECT id FROM vendors LIMIT 1),
    (SELECT name FROM vendors LIMIT 1),
    'عنوان تجريبي',
    'الرياض',
    100.00,
    85.00,
    15.00,
    'pending'
  )
  RETURNING id INTO v_test_order_id;

  RAISE NOTICE '📦 تم إنشاء طلب تجريبي: %', v_test_order_number;
  RAISE NOTICE '';

  -- انتظار لحظة لتطبيق الـ triggers
  PERFORM pg_sleep(0.5);

  -- فحص الحالة النهائية
  SELECT status INTO v_final_status
  FROM orders
  WHERE id = v_test_order_id;

  -- فحص وجوده في قائمة السائقين
  SELECT EXISTS(
    SELECT 1 FROM driver_waiting_list WHERE order_id = v_test_order_id
  ) INTO v_in_waiting_list;

  RAISE NOTICE '🔍 نتيجة الاختبار:';
  RAISE NOTICE '   الحالة النهائية: %', v_final_status;

  IF v_final_status = 'processing' THEN
    RAISE NOTICE '   ✅ تم تحويل الطلب إلى processing بنجاح!';
  ELSE
    RAISE NOTICE '   ❌ الطلب لا يزال في حالة: %', v_final_status;
  END IF;

  IF v_in_waiting_list THEN
    RAISE NOTICE '   ✅ الطلب موجود في قائمة السائقين!';
  ELSE
    RAISE NOTICE '   ❌ الطلب غير موجود في قائمة السائقين!';
  END IF;

  RAISE NOTICE '';

  -- حذف الطلب التجريبي
  DELETE FROM driver_waiting_list WHERE order_id = v_test_order_id;
  DELETE FROM order_status_history WHERE order_id = v_test_order_id;
  DELETE FROM orders WHERE id = v_test_order_id;

  RAISE NOTICE '🗑️ تم حذف الطلب التجريبي';
  RAISE NOTICE '';
  RAISE NOTICE '=== اكتمل الاختبار ===';
END $$;

-- =================================================================
-- ✅ النتيجة المتوقعة
-- =================================================================

/*
  إذا كان كل شيء يعمل بشكل صحيح، يجب أن ترى:

  1️⃣ المعالجة التلقائية مفعّلة ✅
  2️⃣ لا توجد طلبات عالقة في pending
  3️⃣ جميع الـ Triggers مفعّلة
  4️⃣ الطلب التجريبي تحول إلى processing ✅
  5️⃣ الطلب التجريبي موجود في قائمة السائقين ✅

  إذا حدث أي خطأ:
  - راجع الـ NOTICES في الأعلى
  - تأكد من وجود بيانات في جدول vendors
  - تحقق من وجود جدول app_settings
*/
