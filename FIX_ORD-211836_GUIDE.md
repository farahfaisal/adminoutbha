# دليل إصلاح الطلب ORD-211836 والطلبات المشابهة

## المشكلة

الطلب **ORD-211836** في حالة `processing` (المعالجة التلقائية تعمل)، لكنه **لا يظهر** في `driver_waiting_list` للسائقين.

---

## السبب المحتمل

يمكن أن يحدث هذا لأحد الأسباب التالية:

### 1. الطلب أُنشئ قبل تطبيق الـ Migration
- الـ triggers التي تضيف الطلبات تلقائياً إلى `driver_waiting_list` تم إنشاؤها في migration بتاريخ معين
- إذا كان الطلب أقدم من هذا التاريخ، لن يتم إضافته تلقائياً

### 2. تحديث يدوي للحالة
- إذا قام المسؤول بتحديث الطلب يدوياً من `pending` إلى `processing`
- والـ AFTER UPDATE trigger غير موجود أو معطل

### 3. خطأ أثناء الإضافة
- حدث خطأ أثناء تنفيذ الـ trigger
- مثل: قيمة `total` تساوي `NULL` أو قيد foreign key فشل

### 4. الطلب تم إنشاؤه خارج النظام
- إذا تم إنشاء الطلب من خلال SQL مباشرة بدون المرور بالـ triggers

---

## الحل الشامل

يتكون الحل من 3 خطوات:

### الخطوة 1: التشخيص (اختياري)
نفذ `check_order_ORD-211836.sql` للحصول على تقرير شامل

### الخطوة 2: الإصلاح السريع
نفذ `fix_missing_order_ORD-211836.sql` لإضافة الطلبات المفقودة فوراً

### الخطوة 3: منع المشكلة مستقبلاً
نفذ `add_update_trigger_for_waiting_list.sql` لإضافة AFTER UPDATE trigger

---

## الخطوة 1: التشخيص

### نفذ الاستعلام التالي في Supabase SQL Editor:

```bash
check_order_ORD-211836.sql
```

### النتائج المتوقعة:

#### ✅ إذا كانت المعالجة التلقائية مفعلة:
```
auto_processing: true
status: مفعلة ✅
```

#### ✅ إذا كانت الـ Triggers مفعلة:
```
auto_process_order_trigger: مفعل ✅
auto_add_to_waiting_list_trigger: مفعل ✅
```

#### ❌ إذا لم يكن الطلب في القائمة:
```
in_waiting_list: لا - غير موجود في القائمة ❌
```

---

## الخطوة 2: الإصلاح السريع

### نفذ الاستعلام التالي:

```bash
fix_missing_order_ORD-211836.sql
```

### ما يفعله هذا الملف:

1. **يضيف جميع الطلبات العادية** في حالة `processing` إلى `driver_waiting_list`
2. **يضيف جميع طلبات الكابتن** في حالة `processing`
3. **يضيف جميع طلبات الطرود** في حالة `processing`
4. **يتحقق من إضافة ORD-211836** بالتحديد
5. **يعرض إحصائيات** عن الطلبات المضافة

### النتائج المتوقعة:

```sql
NOTICE: تمت إضافة 5 طلب عادي إلى driver_waiting_list
NOTICE: تمت إضافة 2 طلب كابتن إلى driver_waiting_list
NOTICE: تمت إضافة 1 طلب طرد إلى driver_waiting_list

result: الطلب موجود الآن في driver_waiting_list ✅
```

---

## الخطوة 3: منع المشكلة مستقبلاً

### نفذ الاستعلام التالي:

```bash
add_update_trigger_for_waiting_list.sql
```

### ما يفعله هذا الملف:

يضيف **AFTER UPDATE trigger** يعمل عندما:
- يتم تحديث حالة الطلب من أي حالة إلى `processing`
- التحديث تم يدوياً (ليس من خلال المعالجة التلقائية)
- الطلب ليس لديه سائق معين

### مثال على الاستخدام:

```sql
-- تحديث يدوي لحالة الطلب
UPDATE orders
SET status = 'processing'
WHERE order_number = 'ORD-211836';

-- الـ trigger سيضيفه تلقائياً إلى driver_waiting_list
-- ويعرض رسالة:
-- NOTICE: تمت إضافة الطلب ORD-211836 إلى driver_waiting_list عند التحديث اليدوي
```

---

## التحقق من نجاح الإصلاح

### بعد تنفيذ الخطوات أعلاه، نفذ:

```sql
-- 1. التحقق من وجود الطلب في القائمة
SELECT
  dwl.id,
  o.order_number,
  dwl.total,
  dwl.status,
  dwl.created_at
FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'ORD-211836';
```

**النتيجة المتوقعة:**
- سجل واحد يحتوي على الطلب ORD-211836 ✅

```sql
-- 2. التحقق من الـ triggers
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN 'مفعل ✅'
    ELSE 'معطل ❌'
  END as status
FROM pg_trigger
WHERE tgname LIKE '%waiting%'
ORDER BY tgname;
```

**النتيجة المتوقعة:**
- 6 triggers مفعلة (3 للـ INSERT + 3 للـ UPDATE)

---

## مخطط التدفق بعد الإصلاح

### السيناريو 1: طلب جديد

```
عميل يُنشئ طلباً جديداً
    ↓
[BEFORE INSERT] auto_process_new_order()
    → status = processing
    ↓
[حفظ في قاعدة البيانات]
    ↓
[AFTER INSERT] auto_add_to_waiting_list()
    → إضافة إلى driver_waiting_list
    ↓
✅ الطلب متاح للسائقين فوراً
```

### السيناريو 2: تحديث يدوي

```
مدير يحول طلباً من pending إلى processing
    ↓
[AFTER UPDATE] add_to_waiting_list_on_manual_update()
    → إضافة إلى driver_waiting_list
    ↓
✅ الطلب متاح للسائقين فوراً
```

---

## اختبار النظام

### اختبار 1: طلب جديد

```sql
-- إنشاء طلب تجريبي
INSERT INTO orders (
  order_number,
  vendor_id,
  customer_id,
  total,
  status,
  delivery_address,
  customer_phone
) VALUES (
  'TEST-001',
  (SELECT id FROM vendors LIMIT 1),
  (SELECT id FROM customers LIMIT 1),
  50.00,
  'pending', -- سيتحول تلقائياً إلى processing
  'عنوان تجريبي',
  '0512345678'
);

-- التحقق من وجوده في driver_waiting_list
SELECT
  COUNT(*) as in_waiting_list
FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'TEST-001';
-- النتيجة المتوقعة: 1
```

### اختبار 2: تحديث يدوي

```sql
-- إنشاء طلب في حالة pending
INSERT INTO orders (
  order_number,
  vendor_id,
  customer_id,
  total,
  status,
  delivery_address,
  customer_phone
) VALUES (
  'TEST-002',
  (SELECT id FROM vendors LIMIT 1),
  (SELECT id FROM customers LIMIT 1),
  75.00,
  'pending', -- نتركه pending هذه المرة
  'عنوان تجريبي',
  '0512345678'
);

-- التحقق من عدم وجوده في driver_waiting_list
SELECT COUNT(*) FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'TEST-002';
-- النتيجة المتوقعة: 0

-- الآن نحوله يدوياً إلى processing
UPDATE orders SET status = 'processing' WHERE order_number = 'TEST-002';

-- التحقق من إضافته تلقائياً
SELECT COUNT(*) FROM driver_waiting_list dwl
JOIN orders o ON o.id = dwl.order_id
WHERE o.order_number = 'TEST-002';
-- النتيجة المتوقعة: 1 ✅
```

---

## استكشاف الأخطاء

### المشكلة: الطلب ما زال غير موجود بعد التنفيذ

**الحلول:**

#### 1. تحقق من حالة الطلب
```sql
SELECT status, driver_id
FROM orders
WHERE order_number = 'ORD-211836';
```

- إذا كان `status != 'processing'` → حول الحالة إلى `processing`
- إذا كان `driver_id IS NOT NULL` → الطلب مُعين لسائق بالفعل (لا يحتاج للقائمة)

#### 2. تحقق من المعالجة التلقائية
```sql
SELECT settings->'orders'->>'autoProcessing'
FROM app_settings;
```

- إذا كانت `false` → فعّل المعالجة التلقائية:
```sql
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'true'::jsonb
);
```

#### 3. تحقق من الـ Triggers
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%waiting%';
```

- إذا كان أي trigger معطل (`tgenabled = 'D'`)، فعّله:
```sql
ALTER TABLE orders ENABLE TRIGGER auto_add_to_waiting_list_trigger;
```

#### 4. إضافة يدوية مباشرة
```sql
INSERT INTO driver_waiting_list (
  order_id, vendor_id, total, status, created_at
)
SELECT
  o.id, o.vendor_id, o.total, 'pending', now()
FROM orders o
WHERE o.order_number = 'ORD-211836'
ON CONFLICT (order_id) DO NOTHING;
```

---

## الإحصائيات والمراقبة

### عدد الطلبات في driver_waiting_list

```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders
FROM driver_waiting_list;
```

### طلبات processing بدون سائق وليست في القائمة

```sql
SELECT COUNT(*) as missing_orders
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  );
```

**إذا كان العدد > 0:** نفذ `fix_missing_order_ORD-211836.sql` مرة أخرى

---

## الملخص

بعد تطبيق الحلول:

✅ الطلب ORD-211836 سيظهر في `driver_waiting_list`
✅ جميع الطلبات في حالة `processing` ستُضاف تلقائياً
✅ أي تحويل يدوي من `pending` إلى `processing` سيضيف الطلب تلقائياً
✅ النظام يعمل لجميع أنواع الطلبات (عادية، كابتن، طرود)

---

## الملفات المطلوبة

1. **check_order_ORD-211836.sql** - للتشخيص
2. **fix_missing_order_ORD-211836.sql** - للإصلاح الفوري
3. **add_update_trigger_for_waiting_list.sql** - لمنع المشكلة مستقبلاً

---

**تاريخ الإنشاء:** 2 فبراير 2026
**الحالة:** جاهز للتطبيق ✅
