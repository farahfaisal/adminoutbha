# ✅ رؤية الطلبات في حالة processing للبائعين والسائقين

## الإجابة المختصرة

**نعم ✅** - البائعون والسائقون **يرون** الطلبات في حالة **"processing"** (قيد التحضير) وجميع الحالات الأخرى **ماعدا pending**.

---

## 📊 جدول الرؤية حسب الحالة

| الحالة | البائع | السائق | العميل | المدير |
|--------|-------|--------|--------|--------|
| `pending` | ❌ لا | ❌ لا | ✅ نعم | ✅ نعم |
| `processing` | ✅ **نعم** | ✅ **نعم** | ✅ نعم | ✅ نعم |
| `waiting-for-driver` | ✅ نعم | ✅ نعم | ✅ نعم | ✅ نعم |
| `confirmed` | ✅ نعم | ✅ نعم | ✅ نعم | ✅ نعم |
| `on-the-way` | ✅ نعم | ✅ نعم | ✅ نعم | ✅ نعم |
| `delivered` | ✅ نعم | ✅ نعم | ✅ نعم | ✅ نعم |
| `cancelled` | ✅ نعم | ✅ نعم | ✅ نعم | ✅ نعم |

### الخلاصة:
- **البائعون:** يرون الطلبات من `processing` وما بعدها ✅
- **السائقون:** يرون الطلبات من `processing` وما بعدها (إذا كانوا معينين) ✅
- **الطلبات في `pending`:** مخفية عن البائعين والسائقين ❌

---

## 🔍 التفاصيل الفنية

### 1. سياسات البائعين (Vendors)

#### في جدول `orders` (الطلبات العادية)
```sql
CREATE POLICY "Vendors can view their orders (exclude pending)"
ON orders FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND status != 'pending'  -- 👈 الشرط الأساسي
);
```

**ماذا يعني هذا؟**
- البائع يرى طلباته فقط (vendor_id)
- **الشرط:** `status != 'pending'`
- **النتيجة:** يرى `processing`, `waiting-for-driver`, `confirmed`, إلخ ✅

#### في جدول `captain_orders` (طلبات الكابتن)
```sql
CREATE POLICY "Vendors can view own captain orders (exclude pending)"
ON captain_orders FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND status != 'pending'
);
```

**نفس المنطق** - البائع يرى طلبات الكابتن في حالة `processing` وما بعدها ✅

---

### 2. سياسات السائقين (Drivers)

#### في جدول `orders` (الطلبات العادية)
```sql
CREATE POLICY "Drivers can view their assigned orders (exclude pending)"
ON orders FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND status != 'pending'  -- 👈 الشرط الأساسي
);
```

**ماذا يعني هذا؟**
- السائق يرى طلباته المعينة فقط (driver_id)
- **الشرط:** `status != 'pending'`
- **النتيجة:** يرى `processing`, `waiting-for-driver`, `confirmed`, إلخ ✅

#### في جدول `captain_orders` (طلبات الكابتن)
```sql
CREATE POLICY "Drivers can view assigned captain orders (exclude pending)"
ON captain_orders FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND status != 'pending'
);
```

#### في جدول `parcel_orders` (طلبات الطرود)
```sql
CREATE POLICY "Drivers can view their assigned parcel orders (exclude pending)"
ON parcel_orders FOR SELECT
TO authenticated
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
  AND status != 'pending'
);
```

**نفس المنطق** لجميع أنواع الطلبات ✅

---

## 💡 أمثلة عملية

### مثال 1: معالجة تلقائية (Auto Processing = true)

```
الخطوة 1: العميل يطلب طلباً
    ↓
الخطوة 2: النظام يحول الطلب تلقائياً إلى "processing"
    ↓
الخطوة 3: ✅ البائع يرى الطلب فوراً في لوحة تحكمه
    ↓
الخطوة 4: الطلب يُضاف إلى driver_waiting_list
    ↓
الخطوة 5: ✅ السائقون يرون الطلب في قائمة الانتظار
    ↓
الخطوة 6: سائق يقبل الطلب
    ↓
الخطوة 7: ✅ السائق المعين يرى الطلب في لوحة تحكمه
```

**النتيجة:** البائع والسائق يرون الطلب من البداية ✅

---

### مثال 2: معالجة يدوية (Auto Processing = false)

```
الخطوة 1: العميل يطلب طلباً
    ↓
الخطوة 2: الطلب يبقى في حالة "pending"
    ↓
الخطوة 3: ❌ البائع لا يرى الطلب
              ❌ السائقون لا يرون الطلب
              ✅ فقط المدير يراه
    ↓
الخطوة 4: المدير يراجع الطلب
    ↓
الخطوة 5: المدير يوافق → الطلب يتحول إلى "processing"
    ↓
الخطوة 6: ✅ الآن البائع يرى الطلب
    ↓
الخطوة 7: الطلب يُضاف إلى driver_waiting_list
    ↓
الخطوة 8: ✅ السائقون يرون الطلب
```

**النتيجة:** البائع والسائق يرون الطلب **فقط بعد الموافقة** ✅

---

### مثال 3: العميل

```
الخطوة 1: العميل يطلب طلباً
    ↓
الخطوة 2: بغض النظر عن الحالة (pending أو processing):
    ↓
✅ العميل يرى طلبه دائماً في صفحة "طلباتي"
```

**النتيجة:** العميل يرى طلباته في **جميع** الحالات ✅

---

## 🧪 كيف تختبر الرؤية؟

### اختبار 1: البائع

1. سجل دخول كبائع
2. انتقل إلى صفحة الطلبات
3. **يجب أن ترى:**
   - ✅ الطلبات في حالة `processing`
   - ✅ الطلبات في حالة `waiting-for-driver`
   - ✅ الطلبات في حالة `confirmed`
   - وجميع الحالات الأخرى ماعدا `pending`

4. **يجب ألا ترى:**
   - ❌ الطلبات في حالة `pending`

### اختبار 2: السائق

1. سجل دخول كسائق
2. انتقل إلى صفحة الطلبات أو قائمة الانتظار
3. **يجب أن ترى:**
   - ✅ الطلبات المعينة لك في حالة `processing`
   - ✅ الطلبات المتاحة في `waiting-for-driver`
   - ✅ طلباتك في `confirmed`, `on-the-way`

4. **يجب ألا ترى:**
   - ❌ الطلبات في حالة `pending`
   - ❌ طلبات سائقين آخرين (ماعدا في قائمة الانتظار)

### اختبار 3: من قاعدة البيانات

```sql
-- اختبار سياسات البائع
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "بائع-user-id"}';

SELECT order_number, status
FROM orders
WHERE vendor_id = 'بائع-vendor-id'
ORDER BY created_at DESC;

-- يجب أن ترى الطلبات من processing وما بعدها
-- يجب ألا ترى الطلبات في pending
```

```sql
-- اختبار سياسات السائق
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "سائق-user-id"}';

SELECT order_number, status
FROM orders
WHERE driver_id = 'سائق-user-id'
ORDER BY created_at DESC;

-- يجب أن ترى طلباتك المعينة من processing وما بعدها
-- يجب ألا ترى الطلبات في pending
```

---

## 🔐 الأمان

### ما تم حمايته:

1. **حذف السياسات الخطرة:**
   ```sql
   DROP POLICY IF EXISTS "Public can view orders" ON orders;
   DROP POLICY IF EXISTS "Anonymous users can view orders" ON orders;
   DROP POLICY IF EXISTS "Allow viewing all orders" ON orders;
   DROP POLICY IF EXISTS "Users can view all parcel orders" ON parcel_orders;
   ```

2. **تطبيق مبدأ الأقل امتياز:**
   - كل مستخدم يرى **فقط** ما يخصه
   - البائع: طلبات متجره فقط
   - السائق: طلباته المعينة فقط
   - العميل: طلباته الخاصة فقط

3. **الحماية من الطلبات قيد المراجعة:**
   - الطلبات في `pending` مخفية عن البائعين والسائقين
   - فقط المديرون يراجعون ويوافقون
   - بعد الموافقة → يصبح الطلب مرئياً

---

## ⚙️ الإعدادات المتعلقة

### تفعيل/تعطيل المعالجة التلقائية

```sql
-- تفعيل (الطلبات تصبح processing فوراً)
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'true'
);

-- تعطيل (الطلبات تبقى pending حتى الموافقة)
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'false'
);
```

### فحص الإعداد الحالي

```sql
SELECT
  (settings->'orders'->>'autoProcessing')::boolean as auto_processing,
  CASE
    WHEN (settings->'orders'->>'autoProcessing')::boolean = true
    THEN 'الطلبات تصبح processing تلقائياً → البائع والسائق يرونها فوراً ✅'
    ELSE 'الطلبات تبقى pending → فقط المدير يراها حتى الموافقة ⏸️'
  END as explanation
FROM app_settings;
```

---

## 📝 ملاحظات مهمة

### 1. البائعون

- ✅ يرون طلباتهم من `processing` وما بعدها
- ❌ لا يرون طلبات البائعين الآخرين
- ❌ لا يرون الطلبات في `pending` (قبل الموافقة)

### 2. السائقون

- ✅ يرون طلباتهم المعينة من `processing` وما بعدها
- ✅ يرون جميع الطلبات في `waiting-for-driver` (قائمة الانتظار)
- ❌ لا يرون طلبات سائقين آخرين بعد التعيين
- ❌ لا يرون الطلبات في `pending`

### 3. العملاء

- ✅ يرون **جميع** طلباتهم في **كل** الحالات
- لا توجد قيود على العملاء

### 4. المديرون

- ✅ يرون **جميع** الطلبات في **كل** الحالات
- لا توجد قيود على المديرين

---

## 🐛 استكشاف الأخطاء

### المشكلة: البائع لا يرى طلباته في processing

#### السبب المحتمل 1: الطلبات في حالة pending
```sql
-- فحص حالة الطلبات
SELECT order_number, status, vendor_id
FROM orders
WHERE vendor_id = 'بائع-vendor-id'
ORDER BY created_at DESC
LIMIT 10;
```

**الحل:** إذا كانت الطلبات في `pending`، هذا طبيعي! البائع لن يراها حتى تصبح `processing`.

#### السبب المحتمل 2: vendor_id غير مطابق
```sql
-- فحص vendor_id للبائع
SELECT v.id as vendor_id, v.user_id, u.email
FROM vendors v
JOIN auth.users u ON u.id = v.user_id
WHERE v.user_id = 'بائع-user-id';
```

**الحل:** تأكد من أن `vendor_id` في الطلبات يطابق `id` البائع في جدول `vendors`.

#### السبب المحتمل 3: السياسات غير مفعلة
```sql
-- فحص السياسات
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'orders'
  AND policyname LIKE '%Vendors%'
ORDER BY policyname;
```

**الحل:** إذا لم تظهر السياسة "Vendors can view their orders (exclude pending)"، قم بتطبيق الـ migration.

---

### المشكلة: السائق لا يرى طلباته المعينة

#### السبب المحتمل 1: الطلب في حالة pending
نفس الحل أعلاه - السائق لن يرى الطلبات في `pending`.

#### السبب المحتمل 2: driver_id غير مطابق
```sql
-- فحص driver_id للسائق
SELECT id, user_id, name
FROM drivers
WHERE user_id = 'سائق-user-id';
```

```sql
-- فحص الطلبات المعينة للسائق
SELECT order_number, status, driver_id
FROM orders
WHERE driver_id = 'سائق-user-id'
ORDER BY created_at DESC;
```

**الحل:** تأكد من أن `driver_id` في الطلبات يطابق `user_id` السائق.

---

## ✅ التأكيد النهائي

### السياسات الحالية تؤكد:

```
✅ البائعون يرون الطلبات في حالة "processing"
✅ السائقون يرون الطلبات في حالة "processing"
✅ الطلبات في "pending" مخفية عن البائعين والسائقين
✅ المديرون يرون جميع الطلبات في كل الحالات
✅ العملاء يرون طلباتهم في كل الحالات
```

### ملفات الـ Migration ذات الصلة:

1. `20260202203230_restrict_pending_orders_visibility.sql`
   - إنشاء السياسات الأساسية

2. `20260202210430_remove_dangerous_orders_policy_and_enforce_pending_restriction.sql`
   - تأكيد السياسات وحذف السياسات الخطرة

3. `20260202210525_remove_duplicate_vendor_orders_policy.sql`
   - حذف السياسات المكررة

---

## 🎉 الخلاصة

**نعم ✅** - النظام يعمل بشكل صحيح:

1. **البائعون** يرون طلباتهم في حالة **"processing"** وما بعدها
2. **السائقون** يرون طلباتهم المعينة في حالة **"processing"** وما بعدها
3. الطلبات في **"pending"** مخفية عن البائعين والسائقين (أمان ✅)
4. **المديرون** يرون كل شيء
5. **العملاء** يرون طلباتهم الخاصة في كل الحالات

النظام مصمم ليعمل مع نظام المعالجة التلقائية/اليدوية بشكل مثالي! 🚀
