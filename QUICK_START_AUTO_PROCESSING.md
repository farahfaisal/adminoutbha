# دليل سريع: المعالجة التلقائية وإرسال الطلبات للسائقين

## 🎯 الهدف

جعل جميع الطلبات (العادية، الكابتن، والطرود) تدخل في المعالجة التلقائية وتُرسل مباشرة للسائقين والبائعين.

---

## ⚡ التطبيق السريع

### الخطوة 1: تطبيق الكود

1. افتح **Supabase Dashboard**
2. اذهب إلى **SQL Editor**
3. انسخ محتويات ملف: `ENABLE_AUTO_PROCESSING_ALL_ORDERS.sql`
4. شغّل الكود
5. ✅ تم!

### الخطوة 2: تفعيل المعالجة التلقائية

```sql
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'true'
);
```

---

## 📊 كيف يعمل النظام؟

```
┌──────────────────┐
│  طلب جديد يدخل  │
│  status: pending │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ ✅ BEFORE INSERT Trigger      │
│ تحويل الحالة:                │
│ pending → processing         │
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ✅ AFTER INSERT Trigger          │
│ إضافة إلى driver_waiting_list  │
│ السائقون يرون الطلب مباشرة     │
└─────────────────────────────────┘
```

---

## 🔍 ما الذي يحدث بالتفصيل؟

### للطلبات العادية (orders)

```sql
-- 1. الطلب يُحفظ بحالة processing
-- 2. يُضاف إلى driver_waiting_list:
INSERT INTO driver_waiting_list (
  order_id,      -- معرف الطلب
  vendor_id,     -- معرف البائع
  total,         -- إجمالي الطلب
  status,        -- 'pending' (جاهز للسائقين)
  created_at
)
```

### لطلبات الكابتن (captain_orders)

```sql
-- 1. الطلب يُحفظ بحالة processing
-- 2. يُضاف إلى driver_waiting_list:
INSERT INTO driver_waiting_list (
  captain_order_id,  -- معرف طلب الكابتن
  vendor_id,         -- NULL (لا يوجد بائع)
  total,             -- delivery_fee
  status,            -- 'pending' (جاهز للسائقين)
  created_at
)
```

### لطلبات الطرود (parcel_orders)

```sql
-- 1. الطلب يُحفظ بحالة processing
-- 2. يُضاف إلى driver_waiting_list:
INSERT INTO driver_waiting_list (
  parcel_order_id,    -- معرف طلب الطرد
  vendor_id,          -- NULL
  total,              -- delivery_fee
  status,             -- 'pending' (جاهز للسائقين)
  geocoded_latitude,  -- إحداثيات المرسل
  geocoded_longitude, -- إحداثيات المرسل
  created_at
)
```

---

## ✅ التحقق من التطبيق

### فحص سريع

```sql
-- 1. فحص الـ Triggers
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%auto_%'
ORDER BY tgname;

-- يجب أن ترى 6 triggers نشطة
```

### اختبار عملي

```sql
-- 1. أنشئ طلب تجريبي
INSERT INTO orders (
  id, order_number, customer_id, vendor_id,
  delivery_address, total, status
) VALUES (
  gen_random_uuid(),
  'TEST-12345',
  (SELECT id FROM users WHERE role = 'customer' LIMIT 1),
  (SELECT id FROM vendors LIMIT 1),
  'عنوان تجريبي',
  100.00,
  'pending'
);

-- 2. تحقق من الحالة
SELECT order_number, status FROM orders WHERE order_number = 'TEST-12345';
-- النتيجة المتوقعة: status = 'processing' ✅

-- 3. تحقق من القائمة
SELECT * FROM driver_waiting_list
WHERE order_id = (SELECT id FROM orders WHERE order_number = 'TEST-12345');
-- النتيجة المتوقعة: موجود في القائمة ✅

-- 4. تنظيف
DELETE FROM driver_waiting_list WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'TEST-12345');
DELETE FROM orders WHERE order_number = 'TEST-12345';
```

---

## 🎉 النتيجة النهائية

عند تفعيل المعالجة التلقائية:

| الخطوة | ماذا يحدث؟ |
|-------|-----------|
| 1️⃣ | الطلب يدخل بحالة `pending` |
| 2️⃣ | النظام يحوله تلقائياً إلى `processing` |
| 3️⃣ | يُضاف تلقائياً إلى `driver_waiting_list` |
| 4️⃣ | **السائقون يرون الطلب فوراً** 🚀 |
| 5️⃣ | **البائعون يرون الطلب فوراً** 🚀 |

---

## 📝 ملاحظات هامة

- ✅ **جميع أنواع الطلبات**: العادية، الكابتن، والطرود
- ✅ **تلقائي بالكامل**: لا حاجة لأي تدخل يدوي
- ✅ **آمن**: يستخدم `ON CONFLICT DO NOTHING` لمنع التكرار
- ✅ **قابل للتحكم**: يمكن تفعيل/تعطيل من الإعدادات
- ✅ **الطلبات الموجودة**: الـ migration يضيف أيضاً الطلبات الموجودة

---

## 🆘 حل المشاكل

### المشكلة: الطلبات لا تظهر للسائقين

**السبب المحتمل 1: المعالجة التلقائية معطلة**
```sql
-- تفعيل
UPDATE app_settings
SET settings = jsonb_set(settings, '{orders,autoProcessing}', 'true');
```

**السبب المحتمل 2: الطلبات القديمة لم تُضف**
```sql
-- إضافة الطلبات الموجودة
INSERT INTO driver_waiting_list (order_id, vendor_id, total, status, created_at)
SELECT id, vendor_id, total, 'pending', now()
FROM orders
WHERE status = 'processing'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = orders.id)
ON CONFLICT (order_id) DO NOTHING;
```

---

## 📚 ملفات ذات صلة

- `ENABLE_AUTO_PROCESSING_ALL_ORDERS.sql` - الكود الكامل للتطبيق
- `AUTO_PROCESSING_ALL_ORDERS_GUIDE.md` - الدليل التفصيلي الكامل
- `AUTO_PROCESSING_CONFIRMATION.md` - التأكيد والتحقق

---

**تاريخ الإنشاء:** 4 فبراير 2026
**الحالة:** جاهز للتطبيق ✅
