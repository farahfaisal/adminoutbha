# مشكلة: اختفاء الطلبات فوراً عند وصولها

## 🚨 المشكلة

الطلبات تصل ثم تختفي فوراً من لوحة التحكم، مما يعطي انطباعاً بأنها "مرفوضة".

---

## 🔍 التشخيص

### السبب الحقيقي: نظام الرؤية (RLS Policies)

الطلبات **لا يتم رفضها**، ولكن هناك قيود أمان (RLS) تمنع البائعين والسائقين من رؤية الطلبات بحالة `pending`:

```sql
-- من الملف: 20260202203230_restrict_pending_orders_visibility.sql

-- البائعون لا يرون الطلبات في حالة pending
CREATE POLICY "Vendors can view their orders (exclude pending)"
ON orders FOR SELECT
USING (
  vendor_id = ...
  AND status != 'pending'  -- ❌ الطلبات pending مخفية
);

-- السائقون لا يرون الطلبات في حالة pending
CREATE POLICY "Drivers can view their assigned orders (exclude pending)"
ON orders FOR SELECT
USING (
  driver_id = auth.uid()
  AND status != 'pending'  -- ❌ الطلبات pending مخفية
);
```

---

## 📊 السيناريوهات المحتملة

### السيناريو 1: المعالجة التلقائية **مفعّلة** ✅

**التدفق الطبيعي:**
```
1. الطلب يصل: status = 'pending'
   → البائع لا يراه (مخفي بسبب RLS)

2. بعد 0.1 ثانية: trigger يحوله إلى 'processing'
   → البائع يراه الآن! ✅
   → السائق يراه في driver_waiting_list ✅
```

**النتيجة:** الطلب يظهر بشكل طبيعي بعد لحظات قليلة.

**إذا كانت المشكلة موجودة في هذا السيناريو:**
- ربما الصفحة تحتاج refresh لعرض الطلبات الجديدة
- أو هناك مشكلة في real-time subscriptions

---

### السيناريو 2: المعالجة التلقائية **معطّلة** ❌

**التدفق:**
```
1. الطلب يصل: status = 'pending'
   → البائع لا يراه (مخفي بسبب RLS) ❌
   → السائق لا يراه ❌

2. الطلب يبقى في حالة 'pending' إلى الأبد
   → فقط المدير (Admin) يستطيع رؤيته
   → البائع والسائق لن يرونه أبداً
```

**النتيجة:** **هذا هو السبب المحتمل للمشكلة!**

---

## ✅ الحلول

### الحل 1: التحقق من تفعيل المعالجة التلقائية

```sql
-- في Supabase SQL Editor
SELECT
  (settings->'orders'->>'autoProcessing')::boolean as is_enabled,
  settings->'orders' as orders_settings
FROM app_settings
LIMIT 1;
```

**إذا كانت النتيجة:**
- `is_enabled = false` أو `NULL` → **المشكلة هنا!**
- `is_enabled = true` → المعالجة التلقائية مفعلة ✅

#### لتفعيل المعالجة التلقائية:

```sql
-- الطريقة 1: إذا كانت الإعدادات موجودة
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'true'::jsonb
);

-- الطريقة 2: إذا لم تكن الإعدادات موجودة
INSERT INTO app_settings (settings)
VALUES ('{"orders": {"autoProcessing": true}}'::jsonb)
ON CONFLICT DO UPDATE
SET settings = EXCLUDED.settings;
```

---

### الحل 2: فحص الـ Triggers

تأكد من أن الـ Triggers مفعلة:

```sql
-- فحص الـ triggers
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled ✅'
    WHEN 'D' THEN 'disabled ❌'
    ELSE 'other'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'orders'
  AND t.tgname IN (
    'auto_process_order_trigger',
    'auto_add_to_waiting_list_trigger'
  );
```

**إذا كانت معطلة، فعّلها:**

```sql
ALTER TABLE orders ENABLE TRIGGER auto_process_order_trigger;
ALTER TABLE orders ENABLE TRIGGER auto_add_to_waiting_list_trigger;

ALTER TABLE captain_orders ENABLE TRIGGER auto_process_captain_order_trigger;
ALTER TABLE captain_orders ENABLE TRIGGER auto_add_captain_to_waiting_list_trigger;

ALTER TABLE parcel_orders ENABLE TRIGGER auto_process_parcel_order_trigger;
ALTER TABLE parcel_orders ENABLE TRIGGER auto_add_parcel_to_waiting_list_trigger;
```

---

### الحل 3: إضافة الطلبات الموجودة يدوياً

إذا كانت هناك طلبات عالقة في حالة `pending`:

```sql
-- عرض الطلبات العالقة
SELECT
  order_number,
  customer_name,
  vendor_id,
  total,
  status,
  created_at
FROM orders
WHERE status = 'pending'
ORDER BY created_at DESC;

-- تحويلها يدوياً إلى processing
UPDATE orders
SET
  status = 'processing',
  updated_at = now()
WHERE status = 'pending';

-- إضافتها إلى قائمة السائقين
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
```

---

### الحل 4: تحديث Real-time Subscriptions في الواجهة

إذا كانت المشكلة في الواجهة، تأكد من أن الـ subscriptions تستمع للطلبات بحالة `processing`:

```javascript
// في الـ Frontend
const subscription = supabase
  .channel('orders-channel')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: 'status=neq.pending'  // ✅ استمع للطلبات غير pending
    },
    (payload) => {
      console.log('New order:', payload);
      // تحديث القائمة
    }
  )
  .subscribe();
```

---

## 🧪 اختبار الحل

بعد تطبيق الحلول، اختبر بطلب جديد:

```sql
-- 1. إنشاء طلب تجريبي
INSERT INTO orders (
  order_number,
  customer_name,
  customer_phone,
  vendor_id,
  address,
  total,
  status
) VALUES (
  'TEST-' || floor(random() * 100000),
  'زبون تجريبي',
  '0501234567',
  (SELECT id FROM vendors LIMIT 1),
  'عنوان تجريبي',
  100.00,
  'pending'
) RETURNING id, order_number, status;

-- 2. انتظر ثانية واحدة ثم افحص
SELECT order_number, status, created_at, updated_at
FROM orders
WHERE order_number LIKE 'TEST-%'
ORDER BY created_at DESC
LIMIT 1;

-- النتيجة المتوقعة: status = 'processing' ✅

-- 3. تحقق من وجوده في قائمة السائقين
SELECT
  o.order_number,
  o.status as order_status,
  dwl.status as waiting_status,
  dwl.created_at
FROM orders o
JOIN driver_waiting_list dwl ON dwl.order_id = o.id
WHERE o.order_number LIKE 'TEST-%';

-- النتيجة المتوقعة: موجود في القائمة ✅

-- 4. حذف البيانات التجريبية
DELETE FROM driver_waiting_list
WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'TEST-%');

DELETE FROM orders WHERE order_number LIKE 'TEST-%';
```

---

## 📋 ملخص سريع

| المشكلة | الحل |
|---------|------|
| المعالجة التلقائية معطلة | تفعيلها من الإعدادات |
| الـ Triggers معطلة | تفعيلها يدوياً |
| طلبات عالقة في `pending` | تحويلها يدوياً إلى `processing` |
| الواجهة لا تُحدّث | تحديث real-time subscriptions |

---

## 🔗 ملفات ذات صلة

- `ENABLE_AUTO_PROCESSING_ALL_ORDERS.sql` - كود التفعيل الكامل
- `AUTO_PROCESSING_CONFIRMATION.md` - تفاصيل النظام
- `ORDER_VISIBILITY_SYSTEM.md` - شرح نظام الرؤية
- `QUICK_START_AUTO_PROCESSING.md` - دليل البدء السريع

---

**التاريخ:** 4 فبراير 2026
**الحالة:** جاهز للتطبيق ✅
