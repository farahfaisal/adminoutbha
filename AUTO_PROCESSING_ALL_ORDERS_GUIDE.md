# دليل المعالجة التلقائية لجميع أنواع الطلبات

## التغييرات المطبقة

تم تعديل النظام بحيث تشمل المعالجة التلقائية **جميع** أنواع الطلبات:

### ✅ قبل التعديل
- **طلبات عادية (orders)**: معالجة تلقائية ✓
- **طلبات كابتن (captain_orders)**: موافقة يدوية فقط ⚠️
- **طلبات طرود (parcel_orders)**: موافقة يدوية فقط ⚠️

### ✅ بعد التعديل
- **طلبات عادية (orders)**: معالجة تلقائية ✓
- **طلبات كابتن (captain_orders)**: معالجة تلقائية ✓
- **طلبات طرود (parcel_orders)**: معالجة تلقائية ✓

---

## كيفية عمل النظام

### عند تفعيل المعالجة التلقائية

عندما يكون إعداد `autoProcessing = true` في جدول `app_settings`:

1. **الطلب الجديد يدخل بحالة**: `pending`
2. **النظام يحوله تلقائياً إلى**: `processing`
3. **يتم إضافة الطلب إلى قائمة السائقين**: `driver_waiting_list`
4. **السائقون والبائعون يرون الطلب فوراً** ويمكنهم قبوله
5. **يتم إضافة سجل في التاريخ**: "تم القبول تلقائياً وجاري التحضير"

هذا ينطبق على **جميع** أنواع الطلبات:
- طلبات عادية من التطبيق → تضاف بـ `order_id` + `vendor_id`
- طلبات الكابتن (توصيل من مكان لمكان) → تضاف بـ `captain_order_id`
- طلبات الطرود → تضاف بـ `parcel_order_id` + إحداثيات المرسل

### عند تعطيل المعالجة التلقائية

عندما يكون `autoProcessing = false`:

- **جميع** الطلبات تبقى في حالة `pending`
- تحتاج موافقة يدوية من الأدمن
- الأدمن يضغط "✓ قبول" لتحويلها إلى `processing`

---

## التطبيق

### الطريقة الأولى: SQL Editor في Supabase

1. افتح Supabase Dashboard
2. اذهب إلى **SQL Editor**
3. انسخ محتويات ملف `ENABLE_AUTO_PROCESSING_ALL_ORDERS.sql`
4. شغّل الكود

### الطريقة الثانية: Migration File

```bash
# إذا كنت تستخدم Supabase CLI
supabase migration new enable_auto_processing_all_orders
# انسخ محتويات الملف إلى الـ migration الجديد
supabase db push
```

---

## التحقق من التطبيق

### 1. التحقق من الدالة

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'auto_process_new_order';
```

يجب أن ترى الدالة المحدثة **بدون** سطر الاستثناء:
```sql
-- هذا السطر تم إزالته ✓
-- IF TG_TABLE_NAME = 'captain_orders' OR TG_TABLE_NAME = 'parcel_orders' THEN
--   RETURN NEW;
-- END IF;
```

### 2. التحقق من الـ Triggers

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%auto_process%';
```

يجب أن ترى 3 triggers نشطة:
- `auto_process_order_trigger`
- `auto_process_captain_order_trigger`
- `auto_process_parcel_order_trigger`

### 3. اختبار عملي

1. فعّل المعالجة التلقائية من **Settings**
2. أنشئ طلب كابتن جديد أو طلب طرد
3. تحقق من أن حالته تتحول تلقائياً إلى `processing`

---

## الإعدادات

للتحكم في المعالجة التلقائية:

### تفعيل

```sql
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'true'
);
```

### تعطيل

```sql
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'false'
);
```

---

## جدول المقارنة

| نوع الطلب | المعالجة التلقائية مفعلة | المعالجة التلقائية معطلة |
|-----------|-------------------------|------------------------|
| طلبات عادية (orders) | ✅ `pending` → `processing` + إضافة لقائمة السائقين | ⏸️ يبقى `pending` |
| طلبات كابتن (captain_orders) | ✅ `pending` → `processing` + إضافة لقائمة السائقين | ⏸️ يبقى `pending` |
| طلبات طرود (parcel_orders) | ✅ `pending` → `processing` + إضافة لقائمة السائقين | ⏸️ يبقى `pending` |

---

## تفاصيل قائمة السائقين

عند تفعيل المعالجة التلقائية، يتم إضافة الطلبات تلقائياً إلى جدول `driver_waiting_list`:

### طلبات عادية (orders)
```sql
INSERT INTO driver_waiting_list (
  order_id,      -- معرف الطلب
  vendor_id,     -- معرف البائع
  total,         -- إجمالي الطلب
  status,        -- 'pending'
  created_at     -- وقت الإضافة
)
```

### طلبات الكابتن (captain_orders)
```sql
INSERT INTO driver_waiting_list (
  captain_order_id,  -- معرف طلب الكابتن
  vendor_id,         -- NULL
  total,             -- delivery_fee
  status,            -- 'pending'
  created_at         -- وقت الإضافة
)
```

### طلبات الطرود (parcel_orders)
```sql
INSERT INTO driver_waiting_list (
  parcel_order_id,    -- معرف طلب الطرد
  vendor_id,          -- NULL
  total,              -- delivery_fee
  status,             -- 'pending'
  created_at,         -- وقت الإضافة
  geocoded_latitude,  -- إحداثيات المرسل
  geocoded_longitude  -- إحداثيات المرسل
)
```

---

## الملاحظات المهمة

- ✅ **تم إزالة الاستثناء**: لا يوجد معاملة خاصة لطلبات الكابتن والطرود
- ✅ **سلوك موحد**: جميع الطلبات تعمل بنفس الطريقة
- ✅ **التحكم الكامل**: يمكن تفعيل/تعطيل المعالجة التلقائية من الإعدادات
- ✅ **سجل التاريخ**: يتم حفظ سجل لكل تغيير في الحالة
- ✅ **الأمان**: الدالة تعمل بـ `SECURITY DEFINER` لضمان الصلاحيات

---

## الدعم

إذا واجهت أي مشكلة:

1. تحقق من تطبيق الكود بشكل صحيح
2. راجع logs في Supabase Dashboard
3. تأكد من وجود جدول `app_settings` وحقل `settings`
4. تحقق من أن الـ triggers نشطة على جميع الجداول
