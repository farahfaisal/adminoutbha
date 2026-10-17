# تأكيد: المعالجة التلقائية الكاملة مع إرسال للسائقين

## ✅ الحالة: تم التحديث والتطبيق

التاريخ: 4 فبراير 2026
الإصدار: Updated - جميع أنواع الطلبات (Migration: الأحدث)

---

## 📋 السلوك الحالي المؤكد

### عند تفعيل المعالجة التلقائية (autoProcessing = true):

1. **الخطوة 1: إنشاء الطلب**
   - حالة الطلب الأولية: `pending`
   - يتم إنشاء الطلب في أحد الجداول: `orders`, `captain_orders`, أو `parcel_orders`

2. **الخطوة 2: BEFORE INSERT Trigger**
   - اسم الـ Trigger: `auto_process_order_trigger`
   - الدالة المستخدمة: `auto_process_new_order()`
   - الإجراء:
     ```sql
     NEW.status := 'processing';  -- تحويل الحالة
     NEW.updated_at := now();
     ```
   - النتيجة: الطلب يُحفظ بحالة **`processing`** ✅

3. **الخطوة 3: AFTER INSERT Trigger**
   - اسم الـ Trigger: `auto_add_to_waiting_list_trigger`
   - الدالة المستخدمة: `auto_add_to_waiting_list()`
   - الشرط:
     ```sql
     IF v_auto_processing AND NEW.status = 'processing' THEN
     ```
   - الإجراء:
     ```sql
     INSERT INTO driver_waiting_list (
       order_id,           -- أو captain_order_id أو parcel_order_id
       vendor_id,
       total,
       status,            -- 'pending' في القائمة
       created_at
     ) VALUES (...);
     ```
   - النتيجة: الطلب يُضاف إلى **`driver_waiting_list`** ✅

---

## 🎯 النتيجة النهائية

بعد إنشاء الطلب:

| الجدول | الحالة | البائع يراه؟ | السائق يراه؟ |
|--------|--------|--------------|--------------|
| `orders` | `processing` | ✅ نعم | ❌ لا (مباشرة) |
| `driver_waiting_list` | `pending` | ❌ لا | ✅ نعم |

### توضيح مهم:
- **في جدول orders**: الحالة `processing` = البائع يرى الطلب ويعلم أنه قيد التحضير
- **في جدول driver_waiting_list**: الحالة `pending` = الطلب متاح ومعروض للسائقين

---

## 🔍 التحقق من التطبيق

### 1. فحص الـ Triggers

```sql
-- استعلام للتحقق من الـ triggers المفعلة
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled'
    WHEN 'D' THEN 'disabled'
    ELSE 'other'
  END as status,
  CASE t.tgtype::int & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END as level,
  CASE t.tgtype::int & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE t.tgtype::int & 28
    WHEN 4 THEN 'INSERT'
    WHEN 8 THEN 'DELETE'
    WHEN 16 THEN 'UPDATE'
    WHEN 20 THEN 'INSERT OR UPDATE'
    WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    ELSE 'other'
  END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('orders', 'captain_orders', 'parcel_orders')
  AND t.tgname LIKE '%auto%'
ORDER BY c.relname, t.tgname;
```

**النتيجة المتوقعة:**

| trigger_name | table_name | status | level | timing | event |
|-------------|------------|--------|-------|--------|-------|
| auto_process_order_trigger | orders | enabled | ROW | BEFORE | INSERT |
| auto_add_to_waiting_list_trigger | orders | enabled | ROW | AFTER | INSERT |
| auto_process_captain_order_trigger | captain_orders | enabled | ROW | BEFORE | INSERT |
| auto_add_captain_to_waiting_list_trigger | captain_orders | enabled | ROW | AFTER | INSERT |
| auto_process_parcel_order_trigger | parcel_orders | enabled | ROW | BEFORE | INSERT |
| auto_add_parcel_to_waiting_list_trigger | parcel_orders | enabled | ROW | AFTER | INSERT |

---

### 2. فحص الإعدادات

```sql
-- التحقق من حالة المعالجة التلقائية
SELECT
  (settings->'orders'->>'autoProcessing')::boolean as auto_processing_enabled,
  settings->'orders' as orders_settings
FROM app_settings
LIMIT 1;
```

**إذا كانت النتيجة:**
- `auto_processing_enabled = true` ✅ المعالجة التلقائية مفعلة
- `auto_processing_enabled = false` ⚠️ المعالجة التلقائية معطلة
- `auto_processing_enabled = NULL` ⚠️ القيمة غير موجودة (افتراضياً = false)

---

### 3. اختبار عملي

```sql
-- 1. إنشاء طلب تجريبي
INSERT INTO orders (
  id,
  order_number,
  customer_id,
  vendor_id,
  delivery_address,
  total,
  status
) VALUES (
  gen_random_uuid(),
  'TEST-' || floor(random() * 100000),
  (SELECT id FROM users WHERE role = 'customer' LIMIT 1),
  (SELECT id FROM vendors LIMIT 1),
  'عنوان تجريبي',
  100.00,
  'pending'  -- ← الحالة الأولية
) RETURNING id, order_number, status;

-- 2. التحقق من الحالة في orders
SELECT
  order_number,
  status,
  created_at
FROM orders
WHERE order_number LIKE 'TEST-%'
ORDER BY created_at DESC
LIMIT 1;

-- النتيجة المتوقعة: status = 'processing' ✅

-- 3. التحقق من وجود الطلب في driver_waiting_list
SELECT
  dwl.id,
  o.order_number,
  dwl.status as waiting_status,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN orders o ON dwl.order_id = o.id
WHERE o.order_number LIKE 'TEST-%'
ORDER BY dwl.created_at DESC
LIMIT 1;

-- النتيجة المتوقعة: موجود في القائمة بحالة 'pending' ✅

-- 4. تنظيف البيانات التجريبية
DELETE FROM driver_waiting_list
WHERE order_id IN (
  SELECT id FROM orders WHERE order_number LIKE 'TEST-%'
);

DELETE FROM orders WHERE order_number LIKE 'TEST-%';
```

---

## 📝 الكود المصدري

### الدالة 1: auto_process_new_order()

الملف: `supabase/migrations/20260129220845_enable_auto_add_to_waiting_list.sql`
الأسطر: 22-105

```sql
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_has_status_history BOOLEAN;
BEGIN
  -- الحصول على الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE(
    (v_settings->'orders'->>'autoProcessing')::boolean,
    false
  );

  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- ✅ تحويل الطلب إلى processing
    NEW.status := 'processing';
    NEW.updated_at := now();

    -- إضافة سجل في order_status_history
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (order_id, status, note, created_at)
      VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً وجاري التحضير - تمت الإضافة لقائمة السائقين',
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

**الوظيفة:** تحويل الطلب من `pending` إلى `processing`

---

### الدالة 2: auto_add_to_waiting_list()

الملف: `supabase/migrations/20260129220845_enable_auto_add_to_waiting_list.sql`
الأسطر: 107-191

```sql
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
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
  v_auto_processing := COALESCE(
    (v_settings->'orders'->>'autoProcessing')::boolean,
    false
  );

  -- ✅ إذا كانت المعالجة التلقائية مفعلة والطلب في حالة processing
  IF v_auto_processing AND NEW.status = 'processing' THEN
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
        NEW.total,
        'pending',  -- ✅ متاح للسائقين
        now()
      )
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

**الوظيفة:** إضافة الطلب إلى `driver_waiting_list`

---

### الـ Triggers

```sql
-- BEFORE INSERT Triggers (تحويل الحالة)
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- AFTER INSERT Triggers (الإضافة للقائمة)
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- نفس المنطق لـ captain_orders و parcel_orders
```

---

## ⚠️ حل المشاكل المحتملة

### المشكلة 1: الطلبات لا تظهر في driver_waiting_list

**التشخيص:**
```sql
-- 1. فحص حالة الطلب
SELECT id, order_number, status, created_at
FROM orders
WHERE order_number = 'XXX'
LIMIT 1;

-- 2. فحص وجود الطلب في القائمة
SELECT *
FROM driver_waiting_list
WHERE order_id = 'order-id-here';
```

**الأسباب المحتملة:**

#### السبب 1: المعالجة التلقائية معطلة

```sql
-- فحص الإعدادات
SELECT (settings->'orders'->>'autoProcessing')::boolean as enabled
FROM app_settings;

-- الحل: التفعيل
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'true'
);
```

#### السبب 2: الـ Triggers معطلة

```sql
-- فحص حالة الـ triggers
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'orders'::regclass
  AND tgname IN (
    'auto_process_order_trigger',
    'auto_add_to_waiting_list_trigger'
  );

-- الحل: التفعيل
ALTER TABLE orders ENABLE TRIGGER auto_process_order_trigger;
ALTER TABLE orders ENABLE TRIGGER auto_add_to_waiting_list_trigger;
```

#### السبب 3: الطلب أُنشئ قبل تطبيق النظام

```sql
-- الحل: إضافة يدوية
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
  AND id NOT IN (
    SELECT order_id
    FROM driver_waiting_list
    WHERE order_id IS NOT NULL
  )
ON CONFLICT (order_id) DO NOTHING;
```

---

### المشكلة 2: الطلبات تظهر مكررة في القائمة

```sql
-- تشخيص
SELECT order_id, COUNT(*) as count
FROM driver_waiting_list
WHERE order_id IS NOT NULL
GROUP BY order_id
HAVING COUNT(*) > 1;

-- الحل: حذف التكرارات
DELETE FROM driver_waiting_list a
USING driver_waiting_list b
WHERE a.order_id = b.order_id
  AND a.id > b.id;
```

---

## 📊 استعلامات مفيدة

### 1. إحصائيات القائمة

```sql
SELECT
  COUNT(*) as total_in_waiting_list,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders,
  SUM(total) as total_value,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))/60) as avg_waiting_minutes
FROM driver_waiting_list
WHERE status = 'pending';
```

---

### 2. الطلبات في processing المتاحة للسائقين

```sql
SELECT
  o.order_number,
  o.status as order_status,
  dwl.status as waiting_status,
  v.name as vendor_name,
  o.total,
  o.delivery_address,
  o.created_at,
  EXTRACT(EPOCH FROM (now() - o.created_at))/60 as age_minutes
FROM orders o
INNER JOIN driver_waiting_list dwl ON dwl.order_id = o.id
LEFT JOIN vendors v ON o.vendor_id = v.id
WHERE o.status = 'processing'
  AND dwl.status = 'pending'
ORDER BY o.created_at ASC;
```

---

### 3. التحقق من التزامن

```sql
-- الطلبات في processing بدون سائق لكن ليست في القائمة
SELECT
  o.id,
  o.order_number,
  o.status,
  o.created_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  );

-- إذا وجدت نتائج، أضفها يدوياً:
INSERT INTO driver_waiting_list (order_id, vendor_id, total, status, created_at)
SELECT id, vendor_id, total, 'pending', created_at
FROM orders
WHERE status = 'processing'
  AND driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id
  )
ON CONFLICT (order_id) DO NOTHING;
```

---

## ✅ الخلاصة النهائية

### السؤال: هل ترسل الطلبات قيد التحضير (processing) إلى قائمة انتظار السائقين؟

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                    ✅ نعم! بالتأكيد!                        ║
║                                                              ║
║  عند تفعيل المعالجة التلقائية (autoProcessing = true):     ║
║                                                              ║
║  1️⃣ الطلب يتحول تلقائياً إلى processing                     ║
║  2️⃣ يُضاف فوراً إلى driver_waiting_list                    ║
║  3️⃣ يصبح متاحاً للسائقين مباشرة                            ║
║  4️⃣ البائع يراه بحالة "قيد التحضير"                        ║
║  5️⃣ السائق يراه في "قائمة الانتظار"                        ║
║                                                              ║
║  النظام يعمل بكفاءة وأمان تام! 🚀                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📚 المراجع

- **الملف الرئيسي:** `20260129220845_enable_auto_add_to_waiting_list.sql`
- **الدليل الشامل:** `DRIVER_WAITING_LIST_GUIDE.md`
- **نظام الرؤية:** `ORDER_VISIBILITY_SYSTEM.md`

---

**تاريخ التحديث:** 2 فبراير 2026
**الحالة:** مؤكد ومفعّل ✅
