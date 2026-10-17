# حل مشكلة: الطلبات في حالة Processing لا تظهر في قائمة انتظار السائقين

## المشكلة

الطلب رقم **614461** وغيره من الطلبات الموجودة في حالة `processing` لا تظهر في قائمة انتظار السائقين (`driver_waiting_list`)

## السبب

الـ triggers الحالية تعمل فقط على الطلبات **الجديدة** (INSERT):
- `auto_add_to_waiting_list_trigger` يضيف الطلبات الجديدة فقط
- الطلبات التي كانت موجودة قبل تطبيق النظام لا تُضاف تلقائياً
- الطلبات التي تم تحويلها يدوياً إلى `processing` لا تُضاف للقائمة

---

## الحل الشامل (نفذ هذا الكود في Supabase SQL Editor)

```sql
-- ============================================
-- الجزء 1: إضافة الطلبات الموجودة حالياً
-- ============================================

-- 1. إضافة جميع الطلبات العادية في حالة processing
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
  COALESCE(o.total, 0),
  'pending',
  o.created_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- 2. إضافة جميع طلبات الكابتن في حالة processing
INSERT INTO driver_waiting_list (
  captain_order_id,
  vendor_id,
  total,
  status,
  created_at,
  geocoded_latitude,
  geocoded_longitude
)
SELECT
  co.id,
  NULL,
  COALESCE(co.total, 0),
  'pending',
  co.created_at,
  co.pickup_latitude,
  co.pickup_longitude
FROM captain_orders co
WHERE co.status = 'processing'
  AND co.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.captain_order_id = co.id
  )
ON CONFLICT (captain_order_id) DO NOTHING;

-- 3. إضافة جميع طلبات الطرود في حالة processing
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
  NULL,
  COALESCE(po.total, 0),
  'pending',
  po.created_at,
  po.pickup_latitude,
  po.pickup_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
  AND po.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.parcel_order_id = po.id
  )
ON CONFLICT (parcel_order_id) DO NOTHING;


-- ============================================
-- الجزء 2: إضافة Triggers لالتحويلات اليدوية
-- ============================================

-- دالة لإضافة الطلبات عند تحويلها يدوياً إلى processing
CREATE OR REPLACE FUNCTION add_manual_processing_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
BEGIN
  -- الحصول على الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);

  -- إذا كانت المعالجة التلقائية مفعلة وتم تحويل الطلب يدوياً إلى processing
  IF v_auto_processing
     AND OLD.status != 'processing'
     AND NEW.status = 'processing'
     AND NEW.driver_id IS NULL THEN

    -- إضافة إلى driver_waiting_list حسب نوع الطلب
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        total,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        COALESCE(NEW.total, 0),
        'pending',
        now()
      )
      ON CONFLICT (order_id) DO NOTHING;

    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      INSERT INTO driver_waiting_list (
        captain_order_id,
        vendor_id,
        total,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NULL,
        COALESCE(NEW.total, 0),
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      )
      ON CONFLICT (captain_order_id) DO NOTHING;

    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      INSERT INTO driver_waiting_list (
        parcel_order_id,
        vendor_id,
        total,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NULL,
        COALESCE(NEW.total, 0),
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      )
      ON CONFLICT (parcel_order_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- إزالة الـ triggers القديمة على UPDATE إن وجدت
DROP TRIGGER IF EXISTS add_manual_processing_trigger ON orders;
DROP TRIGGER IF EXISTS add_manual_captain_processing_trigger ON captain_orders;
DROP TRIGGER IF EXISTS add_manual_parcel_processing_trigger ON parcel_orders;

-- إضافة AFTER UPDATE triggers لالتقاط التحويلات اليدوية
CREATE TRIGGER add_manual_processing_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();

CREATE TRIGGER add_manual_captain_processing_trigger
  AFTER UPDATE OF status ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();

CREATE TRIGGER add_manual_parcel_processing_trigger
  AFTER UPDATE OF status ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();
```

---

## التحقق من النتائج

بعد تنفيذ الكود أعلاه، نفذ هذا الاستعلام للتحقق:

```sql
-- فحص الطلب 614461
SELECT
  o.order_number,
  o.status as order_status,
  o.driver_id,
  dwl.id as waiting_list_id,
  dwl.status as waiting_status,
  dwl.created_at as added_to_list_at
FROM orders o
LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
WHERE o.order_number = '614461';
```

### النتيجة المتوقعة:

| order_number | order_status | driver_id | waiting_list_id | waiting_status | added_to_list_at |
|-------------|-------------|-----------|----------------|---------------|-----------------|
| 614461 | processing | NULL | [UUID] | pending | [timestamp] |

إذا كانت `waiting_list_id` ليست NULL، فالطلب موجود في القائمة الآن!

---

## فحص شامل لجميع الطلبات

```sql
-- عدد الطلبات في processing
SELECT
  COUNT(*) as total_processing_orders,
  COUNT(dwl.id) as in_waiting_list,
  COUNT(*) - COUNT(dwl.id) as missing_from_list
FROM orders o
LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
WHERE o.status = 'processing'
  AND o.driver_id IS NULL;
```

### النتيجة المتوقعة بعد التطبيق:

```
total_processing_orders: X
in_waiting_list: X
missing_from_list: 0  ← يجب أن تكون صفر!
```

---

## الطلبات المفقودة (إن وجدت)

إذا كانت هناك طلبات لا تزال مفقودة، نفذ هذا الاستعلام لرؤيتها:

```sql
SELECT
  o.id,
  o.order_number,
  o.status,
  o.vendor_id,
  o.total,
  o.created_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  )
ORDER BY o.created_at DESC;
```

---

## كيف يعمل النظام الآن

### السيناريو 1: طلب جديد (مع المعالجة التلقائية مفعلة)

```
إنشاء طلب (pending)
    ↓
BEFORE INSERT Trigger
    ↓
تحويل إلى processing ✅
    ↓
حفظ في قاعدة البيانات
    ↓
AFTER INSERT Trigger
    ↓
إضافة إلى driver_waiting_list ✅
    ↓
متاح للسائقين فوراً!
```

### السيناريو 2: تحويل يدوي إلى processing

```
تحديث حالة الطلب يدوياً
    ↓
من: pending/any → إلى: processing
    ↓
AFTER UPDATE Trigger (الجديد!)
    ↓
إضافة إلى driver_waiting_list ✅
    ↓
متاح للسائقين فوراً!
```

### السيناريو 3: الطلبات الموجودة مسبقاً

```
الطلبات القديمة في processing
    ↓
تنفيذ INSERT الجماعي (الكود أعلاه)
    ↓
إضافة جميع الطلبات المفقودة ✅
    ↓
متاحة للسائقين الآن!
```

---

## الخلاصة

بعد تنفيذ الكود:

1. **الطلب 614461 سيظهر في قائمة السائقين** مباشرة
2. **جميع الطلبات الأخرى في processing** ستظهر أيضاً
3. **أي طلب يُحول يدوياً إلى processing** سيُضاف تلقائياً للقائمة
4. **الطلبات الجديدة** ستُضاف تلقائياً كما كان مخططاً

---

## استعلامات إضافية مفيدة

### 1. عرض جميع الطلبات المتاحة للسائقين

```sql
SELECT
  COALESCE(o.order_number, co.order_number, po.order_number) as order_number,
  CASE
    WHEN dwl.order_id IS NOT NULL THEN 'طلب عادي'
    WHEN dwl.captain_order_id IS NOT NULL THEN 'طلب كابتن'
    WHEN dwl.parcel_order_id IS NOT NULL THEN 'طلب طرد'
  END as order_type,
  dwl.total,
  dwl.status as waiting_status,
  dwl.created_at as added_at,
  EXTRACT(EPOCH FROM (now() - dwl.created_at))/60 as waiting_minutes
FROM driver_waiting_list dwl
LEFT JOIN orders o ON dwl.order_id = o.id
LEFT JOIN captain_orders co ON dwl.captain_order_id = co.id
LEFT JOIN parcel_orders po ON dwl.parcel_order_id = po.id
WHERE dwl.status = 'pending'
ORDER BY dwl.created_at ASC;
```

### 2. إحصائيات القائمة

```sql
SELECT
  COUNT(*) as total_waiting,
  COUNT(order_id) as regular_orders,
  COUNT(captain_order_id) as captain_orders,
  COUNT(parcel_order_id) as parcel_orders,
  SUM(total) as total_value,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))/60) as avg_waiting_minutes,
  MAX(EXTRACT(EPOCH FROM (now() - created_at))/60) as max_waiting_minutes
FROM driver_waiting_list
WHERE status = 'pending';
```

### 3. تنظيف القائمة من الطلبات الملغاة أو المكتملة

```sql
-- حذف الطلبات التي تم إلغاؤها أو إكمالها من القائمة
DELETE FROM driver_waiting_list dwl
WHERE dwl.status = 'pending'
  AND (
    -- طلبات عادية ملغاة أو مكتملة
    (dwl.order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = dwl.order_id
        AND o.status NOT IN ('processing', 'waiting-for-driver')
    ))
    OR
    -- طلبات كابتن ملغاة أو مكتملة
    (dwl.captain_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM captain_orders co
      WHERE co.id = dwl.captain_order_id
        AND co.status NOT IN ('processing', 'waiting-for-driver')
    ))
    OR
    -- طلبات طرود ملغاة أو مكتملة
    (dwl.parcel_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM parcel_orders po
      WHERE po.id = dwl.parcel_order_id
        AND po.status NOT IN ('processing', 'waiting-for-driver')
    ))
  );
```

---

## خطوات التنفيذ

1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. أنشئ استعلام جديد
4. انسخ الكود من "الحل الشامل" أعلاه
5. اضغط Run
6. نفذ استعلامات التحقق
7. تحقق من أن الطلب 614461 موجود الآن في القائمة

---

**تاريخ الإنشاء:** 2 فبراير 2026
**الحالة:** جاهز للتطبيق ✅
