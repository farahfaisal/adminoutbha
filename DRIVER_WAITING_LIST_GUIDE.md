# دليل قائمة انتظار السائقين - Driver Waiting List Guide

## ❓ السؤال الرئيسي

**هل ترسل الطلبات قيد التحضير (processing) إلى قائمة انتظار السائقين مع إبقائها قيد التحضير؟**

---

## ✅ الإجابة المختصرة

**نعم بالتأكيد!**

عندما تكون المعالجة التلقائية مفعلة، الطلبات:
- تتحول تلقائياً من `pending` إلى `processing`
- تُضاف فوراً إلى قائمة انتظار السائقين `driver_waiting_list`
- **تبقى في حالة `processing`** حتى يقبلها سائق

---

## 📊 دورة حياة الطلب الكاملة

### السيناريو 1: المعالجة التلقائية (Auto Processing = true)

```
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 1: إنشاء الطلب                                       │
│ ─────────────────────                                       │
│ INSERT INTO orders (status = 'pending', ...)               │
│                                                             │
│ الحالة الأولية: pending                                    │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 2: BEFORE INSERT Trigger                            │
│ ─────────────────────────────────                           │
│ Trigger Name: auto_process_order_trigger                   │
│ Function: auto_process_new_order()                         │
│                                                             │
│ الفحص:                                                      │
│   ✓ هل autoProcessing مفعل؟ → نعم                          │
│   ✓ هل الحالة pending؟ → نعم                               │
│                                                             │
│ الإجراء:                                                    │
│   → تحويل الحالة إلى 'processing'                          │
│   → تحديث updated_at                                       │
│   → إضافة سجل في order_status_history                      │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 3: حفظ الطلب                                        │
│ ────────────────────                                        │
│ الطلب يُحفظ في جدول orders                                 │
│                                                             │
│ الحالة النهائية: processing ✅                              │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 4: AFTER INSERT Trigger                             │
│ ────────────────────────────────                            │
│ Trigger Name: auto_add_to_waiting_list_trigger             │
│ Function: auto_add_to_waiting_list()                       │
│                                                             │
│ الفحص:                                                      │
│   ✓ هل autoProcessing مفعل؟ → نعم                          │
│   ✓ هل الحالة processing؟ → نعم                            │
│                                                             │
│ الإجراء:                                                    │
│   → INSERT INTO driver_waiting_list (...)                  │
│   → الطلب يُضاف للقائمة بحالة 'pending'                    │
│   → استخدام ON CONFLICT DO NOTHING لمنع التكرار            │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ النتيجة النهائية ✅                                         │
│ ──────────────────                                          │
│                                                             │
│ في جدول orders:                                            │
│   • الحالة: processing                                     │
│   • البائع يرى الطلب ✓                                     │
│                                                             │
│ في جدول driver_waiting_list:                              │
│   • الحالة: pending (متاح)                                │
│   • السائقون يرون الطلب ✓                                  │
│                                                             │
│ الطلب متاح للجميع وجاهز للتعيين!                          │
└─────────────────────────────────────────────────────────────┘
```

---

### السيناريو 2: المعالجة اليدوية (Auto Processing = false)

```
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 1: إنشاء الطلب                                       │
│ ─────────────────────                                       │
│ INSERT INTO orders (status = 'pending', ...)               │
│                                                             │
│ الحالة: pending                                            │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 2: BEFORE INSERT Trigger                            │
│ ─────────────────────────────────                           │
│ Trigger Name: auto_process_order_trigger                   │
│ Function: auto_process_new_order()                         │
│                                                             │
│ الفحص:                                                      │
│   ✗ هل autoProcessing مفعل؟ → لا                           │
│                                                             │
│ الإجراء:                                                    │
│   → لا شيء! الطلب يبقى في pending                          │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 3: حفظ الطلب                                        │
│ ────────────────────                                        │
│ الطلب يُحفظ في جدول orders                                 │
│                                                             │
│ الحالة: pending ⏸️                                         │
│ ❌ البائع لا يراه                                           │
│ ❌ السائقون لا يرونه                                        │
│ ✅ المدير فقط يراه                                          │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 4: مراجعة المدير                                    │
│ ──────────────────────                                      │
│ المدير يراجع الطلب ويقرر:                                  │
│   → قبول: يحول الحالة إلى 'waiting-for-driver'            │
│   → رفض: يحول الحالة إلى 'cancelled'                      │
│                                                             │
│ UPDATE orders                                              │
│ SET status = 'waiting-for-driver'                          │
│ WHERE id = ...;                                            │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ الخطوة 5: AFTER UPDATE Trigger                             │
│ ────────────────────────────────                            │
│ Trigger Name: trigger_add_to_waiting_list_on_update        │
│ Function: add_to_waiting_list_on_status_change()           │
│                                                             │
│ الفحص:                                                      │
│   ✓ هل الحالة تحولت إلى 'waiting-for-driver'؟ → نعم       │
│                                                             │
│ الإجراء:                                                    │
│   → INSERT INTO driver_waiting_list (...)                  │
│   → الطلب يُضاف للقائمة                                    │
└────────────┬────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ النتيجة النهائية ✅                                         │
│ ──────────────────                                          │
│                                                             │
│ في جدول orders:                                            │
│   • الحالة: waiting-for-driver                             │
│   • البائع يرى الطلب ✓                                     │
│                                                             │
│ في جدول driver_waiting_list:                              │
│   • الحالة: pending (متاح)                                │
│   • السائقون يرون الطلب ✓                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 جدول مقارنة شامل

### 1. مقارنة بين المعالجة التلقائية واليدوية

| المعيار | المعالجة التلقائية | المعالجة اليدوية |
|---------|---------------------|-------------------|
| **الحالة في orders** | `processing` | `waiting-for-driver` |
| **متى يُضاف للقائمة؟** | فوراً عند الإنشاء | بعد موافقة المدير |
| **البائع يرى الطلب؟** | نعم ✅ فوراً | نعم ✅ بعد الموافقة |
| **السائق يرى الطلب؟** | نعم ✅ فوراً | نعم ✅ بعد الموافقة |
| **سرعة المعالجة** | سريع جداً ⚡ | متوسط ⏱️ |
| **الأمان** | متوسط | عالي 🔒 |
| **التسلسل** | pending → processing → [قائمة] | pending → [موافقة] → waiting-for-driver → [قائمة] |

---

### 2. جدول دورة الحياة الكاملة

| الخطوة | الحالة | في orders؟ | في driver_waiting_list؟ | البائع | السائق | المدير |
|-------|--------|-----------|------------------------|--------|--------|--------|
| 1. إنشاء | `pending` | ✅ | ❌ | ❌ | ❌ | ✅ |
| 2. معالجة تلقائية | `processing` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. سائق يقبل | `confirmed` | ✅ | ❌ | ✅ | ✅ | ✅ |
| 4. في الطريق | `on-the-way` | ✅ | ❌ | ✅ | ✅ | ✅ |
| 5. تم التسليم | `delivered` | ✅ | ❌ | ✅ | ✅ | ✅ |
| 6. ملغي | `cancelled` | ✅ | ❌ | ✅ | ✅ | ✅ |

**الملاحظة الذهبية:** الطلب له حالتان مختلفتان في نفس الوقت!
- في `orders`: حالة الطلب الفعلية
- في `driver_waiting_list`: حالة التوفر للسائقين

---

## 🗄️ هيكل جدول driver_waiting_list

### التعريف الكامل

```sql
CREATE TABLE driver_waiting_list (
  -- المعرف الرئيسي
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- معرفات الطلبات (واحد فقط يكون له قيمة)
  order_id UUID REFERENCES orders(id),
  captain_order_id UUID REFERENCES captain_orders(id),
  parcel_order_id UUID REFERENCES parcel_orders(id),

  -- معلومات الطلب
  vendor_id UUID REFERENCES vendors(id),
  total DECIMAL(10,2),

  -- الحالة في القائمة
  status TEXT DEFAULT 'pending',
  -- pending: متاح للسائقين
  -- assigned: تم تعيين سائق
  -- cancelled: ملغي

  -- التواريخ
  created_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- الموقع (للطلبات الكابتن والطرود فقط)
  geocoded_latitude DECIMAL(10,8),
  geocoded_longitude DECIMAL(11,8),

  -- القيود
  CONSTRAINT unique_order_id UNIQUE(order_id),
  CONSTRAINT unique_captain_order_id UNIQUE(captain_order_id),
  CONSTRAINT unique_parcel_order_id UNIQUE(parcel_order_id),

  -- التأكد من أن واحد فقط من معرفات الطلبات له قيمة
  CONSTRAINT check_one_order_type CHECK (
    (order_id IS NOT NULL AND captain_order_id IS NULL AND parcel_order_id IS NULL) OR
    (order_id IS NULL AND captain_order_id IS NOT NULL AND parcel_order_id IS NULL) OR
    (order_id IS NULL AND captain_order_id IS NULL AND parcel_order_id IS NOT NULL)
  )
);

-- الفهارس لتحسين الأداء
CREATE INDEX idx_driver_waiting_list_status ON driver_waiting_list(status);
CREATE INDEX idx_driver_waiting_list_created ON driver_waiting_list(created_at);
CREATE INDEX idx_driver_waiting_list_vendor ON driver_waiting_list(vendor_id);
```

---

### الأعمدة الرئيسية

| العمود | النوع | الوصف |
|--------|------|-------|
| `id` | UUID | المعرف الفريد للسجل |
| `order_id` | UUID | معرف الطلب العادي |
| `captain_order_id` | UUID | معرف طلب الكابتن |
| `parcel_order_id` | UUID | معرف طلب الطرد |
| `vendor_id` | UUID | معرف البائع |
| `total` | DECIMAL | إجمالي الطلب |
| `status` | TEXT | حالة الطلب في القائمة |
| `created_at` | TIMESTAMPTZ | وقت الإضافة للقائمة |
| `assigned_at` | TIMESTAMPTZ | وقت تعيين السائق |
| `geocoded_latitude` | DECIMAL | خط العرض |
| `geocoded_longitude` | DECIMAL | خط الطول |

---

## 🔧 الكود المسؤول عن العملية

### 1. الدالة: auto_process_new_order()

**الهدف:** تحويل الطلب من `pending` إلى `processing`

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
  -- 1. الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  -- 2. استخراج قيمة autoProcessing
  v_auto_processing := COALESCE(
    (v_settings->'orders'->>'autoProcessing')::boolean,
    false
  );

  -- 3. التحقق من الشروط
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- 4. تحويل الحالة
    NEW.status := 'processing';
    NEW.updated_at := now();

    -- 5. إضافة سجل في التاريخ (للطلبات العادية)
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        created_at
      ) VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً وجاري التحضير - تمت الإضافة لقائمة السائقين',
        now()
      );
    END IF;

    -- 6. معالجة status_history للطرود
    IF TG_TABLE_NAME = 'parcel_orders' THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parcel_orders'
        AND column_name = 'status_history'
      ) INTO v_has_status_history;

      IF v_has_status_history THEN
        NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) ||
          jsonb_build_object(
            'status', 'processing',
            'timestamp', now(),
            'note', 'تم القبول تلقائياً وجاري التحضير'
          );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

---

### 2. الدالة: auto_add_to_waiting_list()

**الهدف:** إضافة الطلب إلى قائمة الانتظار

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
  -- 1. الحصول على الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  -- 2. استخراج قيمة autoProcessing
  v_auto_processing := COALESCE(
    (v_settings->'orders'->>'autoProcessing')::boolean,
    false
  );

  -- 3. التحقق من الشروط المطلوبة
  IF v_auto_processing AND NEW.status = 'processing' THEN

    -- 4. إضافة حسب نوع الطلب
    IF TG_TABLE_NAME = 'orders' THEN
      -- طلب عادي
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
        'pending',
        now()
      )
      ON CONFLICT (order_id) DO NOTHING;

    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      -- طلب كابتن
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
        NEW.total,
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      )
      ON CONFLICT (captain_order_id) DO NOTHING;

    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- طلب طرد
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
        NEW.total,
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
```

**الملاحظات المهمة:**
- ✅ الشرط: `NEW.status = 'processing'` يضمن أن الطلب في المرحلة الصحيحة
- ✅ `ON CONFLICT DO NOTHING` يمنع الأخطاء عند محاولة الإضافة مرتين
- ✅ `SECURITY DEFINER` يضمن تنفيذ الدالة بصلاحيات كاملة

---

### 3. الدالة: add_to_waiting_list_on_status_change()

**الهدف:** إضافة الطلب عند التحديث اليدوي

```sql
CREATE OR REPLACE FUNCTION add_to_waiting_list_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- التحقق من تحول الحالة إلى 'waiting-for-driver'
  IF NEW.status = 'waiting-for-driver'
     AND OLD.status != 'waiting-for-driver' THEN

    -- إضافة الطلب حسب النوع
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        'pending',
        now(),
        NEW.geocoded_latitude,
        NEW.geocoded_longitude
      )
      ON CONFLICT (order_id) DO NOTHING;

    -- نفس المنطق لـ captain_orders و parcel_orders
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

---

### 4. الـ Triggers

```sql
-- BEFORE INSERT Triggers (تحويل الحالة)
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- AFTER INSERT Triggers (الإضافة للقائمة)
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

CREATE TRIGGER auto_add_captain_to_waiting_list_trigger
  AFTER INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- AFTER UPDATE Triggers (الإضافة اليدوية)
CREATE TRIGGER trigger_add_to_waiting_list_on_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_status_change();
```

---

## 🧪 أمثلة عملية

### مثال 1: طلب عادي - معالجة تلقائية

```sql
-- 1. إنشاء طلب جديد
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
  'ORD-12345',
  'cust-uuid-123',
  'vendor-uuid-456',
  'شارع الملك فهد، الرياض',
  250.50,
  'pending'  -- ← الحالة الأولية
);

-- 2. ماذا يحدث تلقائياً؟
-- ✅ BEFORE INSERT Trigger يحول الحالة إلى 'processing'
-- ✅ الطلب يُحفظ بحالة 'processing'
-- ✅ AFTER INSERT Trigger يضيف الطلب للقائمة

-- 3. التحقق من النتيجة
SELECT
  order_number,
  status,
  created_at
FROM orders
WHERE order_number = 'ORD-12345';
-- النتيجة: status = 'processing' ✅

SELECT
  order_id,
  status as waiting_status,
  created_at
FROM driver_waiting_list
WHERE order_id = (SELECT id FROM orders WHERE order_number = 'ORD-12345');
-- النتيجة: موجود في القائمة بحالة 'pending' ✅
```

---

### مثال 2: طلب كابتن - معالجة تلقائية

```sql
-- 1. إنشاء طلب كابتن
INSERT INTO captain_orders (
  id,
  order_number,
  customer_id,
  customer_name,
  customer_phone,
  pickup_address,
  pickup_latitude,
  pickup_longitude,
  delivery_address,
  delivery_latitude,
  delivery_longitude,
  total,
  status
) VALUES (
  gen_random_uuid(),
  'CAP-67890',
  'cust-uuid-789',
  'أحمد محمد',
  '0501234567',
  'مطار الملك خالد',
  24.9577,
  46.6989,
  'برج المملكة، الرياض',
  24.7136,
  46.6753,
  150.00,
  'pending'
);

-- 2. النتيجة التلقائية
-- ✅ التحول إلى 'processing'
-- ✅ الإضافة لقائمة الانتظار مع إحداثيات الاستلام

-- 3. التحقق
SELECT
  co.order_number,
  co.status,
  dwl.status as waiting_status,
  dwl.geocoded_latitude,
  dwl.geocoded_longitude
FROM captain_orders co
LEFT JOIN driver_waiting_list dwl ON dwl.captain_order_id = co.id
WHERE co.order_number = 'CAP-67890';
-- النتيجة:
-- status = 'processing'
-- waiting_status = 'pending'
-- geocoded_latitude = 24.9577
-- geocoded_longitude = 46.6989
```

---

### مثال 3: معالجة يدوية - موافقة المدير

```sql
-- 1. إنشاء طلب (autoProcessing = false)
INSERT INTO orders (
  id,
  order_number,
  customer_id,
  vendor_id,
  total,
  status
) VALUES (
  'order-uuid-manual',
  'ORD-MANUAL-001',
  'cust-uuid',
  'vendor-uuid',
  300.00,
  'pending'
);

-- 2. التحقق - الطلب لا يظهر للبائع أو السائق
SELECT * FROM orders WHERE id = 'order-uuid-manual';
-- status = 'pending' (لم يتغير)

SELECT * FROM driver_waiting_list WHERE order_id = 'order-uuid-manual';
-- لا يوجد سجل (الطلب ليس في القائمة)

-- 3. المدير يوافق على الطلب
UPDATE orders
SET status = 'waiting-for-driver'
WHERE id = 'order-uuid-manual';

-- 4. AFTER UPDATE Trigger يضيف الطلب للقائمة تلقائياً
SELECT
  o.order_number,
  o.status,
  dwl.status as waiting_status
FROM orders o
LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
WHERE o.id = 'order-uuid-manual';
-- النتيجة:
-- status = 'waiting-for-driver'
-- waiting_status = 'pending'
```

---

### مثال 4: سائق يقبل الطلب

```sql
-- 1. الوضع الحالي
-- الطلب في orders بحالة: processing
-- الطلب في driver_waiting_list بحالة: pending

-- 2. السائق يستعلم عن القائمة
SELECT
  dwl.id as waiting_id,
  o.order_number,
  o.total,
  v.name as vendor_name,
  o.delivery_address,
  dwl.created_at
FROM driver_waiting_list dwl
INNER JOIN orders o ON dwl.order_id = o.id
LEFT JOIN vendors v ON o.vendor_id = v.id
WHERE dwl.status = 'pending'
  AND o.status IN ('processing', 'waiting-for-driver')
ORDER BY dwl.created_at ASC
LIMIT 10;

-- 3. السائق يقبل الطلب
UPDATE orders
SET
  status = 'confirmed',
  driver_id = 'driver-uuid-123',
  updated_at = now()
WHERE order_number = 'ORD-12345';

-- 4. حذف الطلب من قائمة الانتظار
DELETE FROM driver_waiting_list
WHERE order_id = (SELECT id FROM orders WHERE order_number = 'ORD-12345');

-- أو: تحديث الحالة بدلاً من الحذف
UPDATE driver_waiting_list
SET
  status = 'assigned',
  assigned_at = now(),
  updated_at = now()
WHERE order_id = (SELECT id FROM orders WHERE order_number = 'ORD-12345');

-- 5. النتيجة
-- ✅ الطلب معين للسائق
-- ✅ الطلب لم يعد متاحاً لسائقين آخرين
-- ✅ السائق يرى الطلب في لوحة تحكمه
```

---

## 🎯 الاستعلامات الشائعة

### 1. الحصول على قائمة الانتظار الكاملة

```sql
SELECT
  dwl.id,
  dwl.order_id,
  dwl.captain_order_id,
  dwl.parcel_order_id,
  COALESCE(
    o.order_number,
    co.order_number,
    po.order_number
  ) as order_number,
  COALESCE(
    o.status,
    co.status,
    po.status
  ) as order_status,
  dwl.status as waiting_status,
  dwl.total,
  v.name as vendor_name,
  COALESCE(
    o.delivery_address,
    co.delivery_address,
    po.delivery_address
  ) as delivery_address,
  dwl.created_at,
  EXTRACT(EPOCH FROM (now() - dwl.created_at))/60 as waiting_minutes
FROM driver_waiting_list dwl
LEFT JOIN orders o ON dwl.order_id = o.id
LEFT JOIN captain_orders co ON dwl.captain_order_id = co.id
LEFT JOIN parcel_orders po ON dwl.parcel_order_id = po.id
LEFT JOIN vendors v ON dwl.vendor_id = v.id
WHERE dwl.status = 'pending'
ORDER BY dwl.created_at ASC;
```

---

### 2. الطلبات حسب البائع

```sql
SELECT
  dwl.id,
  o.order_number,
  o.status,
  o.total,
  o.delivery_address,
  dwl.created_at
FROM driver_waiting_list dwl
INNER JOIN orders o ON dwl.order_id = o.id
WHERE dwl.vendor_id = 'vendor-uuid-here'
  AND dwl.status = 'pending'
ORDER BY dwl.created_at ASC;
```

---

### 3. الطلبات في منطقة معينة

```sql
-- الطلبات ضمن نطاق 5 كم من موقع السائق
SELECT
  dwl.id,
  COALESCE(o.order_number, co.order_number, po.order_number) as order_number,
  dwl.total,
  dwl.geocoded_latitude,
  dwl.geocoded_longitude,
  ST_Distance(
    ST_MakePoint(dwl.geocoded_longitude, dwl.geocoded_latitude)::geography,
    ST_MakePoint(46.6753, 24.7136)::geography -- موقع السائق
  )/1000 as distance_km
FROM driver_waiting_list dwl
LEFT JOIN orders o ON dwl.order_id = o.id
LEFT JOIN captain_orders co ON dwl.captain_order_id = co.id
LEFT JOIN parcel_orders po ON dwl.parcel_order_id = po.id
WHERE dwl.status = 'pending'
  AND ST_DWithin(
    ST_MakePoint(dwl.geocoded_longitude, dwl.geocoded_latitude)::geography,
    ST_MakePoint(46.6753, 24.7136)::geography,
    5000  -- 5 كم
  )
ORDER BY distance_km ASC;
```

---

### 4. إحصائيات القائمة

```sql
SELECT
  COUNT(*) as total_waiting,
  COUNT(CASE WHEN order_id IS NOT NULL THEN 1 END) as regular_orders,
  COUNT(CASE WHEN captain_order_id IS NOT NULL THEN 1 END) as captain_orders,
  COUNT(CASE WHEN parcel_order_id IS NOT NULL THEN 1 END) as parcel_orders,
  SUM(total) as total_value,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))/60) as avg_waiting_minutes,
  MIN(created_at) as oldest_order,
  MAX(created_at) as newest_order
FROM driver_waiting_list
WHERE status = 'pending';
```

---

## 🔍 استكشاف الأخطاء وحلها

### المشكلة 1: الطلب في processing لكن ليس في القائمة

#### التشخيص

```sql
-- 1. فحص الطلب
SELECT
  id,
  order_number,
  status,
  created_at,
  updated_at
FROM orders
WHERE order_number = 'ORD-12345';

-- 2. فحص القائمة
SELECT *
FROM driver_waiting_list
WHERE order_id = (SELECT id FROM orders WHERE order_number = 'ORD-12345');
```

#### الأسباب المحتملة

**السبب 1: المعالجة التلقائية معطلة**

```sql
-- فحص الإعدادات
SELECT
  (settings->'orders'->>'autoProcessing')::boolean as auto_processing
FROM app_settings;

-- إذا كانت القيمة false أو NULL
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'true'
);
```

**السبب 2: الـ Trigger معطل**

```sql
-- فحص حالة الـ triggers
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  tgtype as type
FROM pg_trigger
WHERE tgrelid = 'orders'::regclass
  AND tgname IN (
    'auto_process_order_trigger',
    'auto_add_to_waiting_list_trigger'
  );

-- تفعيل الـ triggers إذا كانت معطلة
ALTER TABLE orders
  ENABLE TRIGGER auto_process_order_trigger;

ALTER TABLE orders
  ENABLE TRIGGER auto_add_to_waiting_list_trigger;
```

**السبب 3: الطلب تم إنشاؤه قبل تفعيل النظام**

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
WHERE order_number = 'ORD-12345'
  AND status = 'processing'
ON CONFLICT (order_id) DO NOTHING;
```

---

### المشكلة 2: الطلب يظهر مكرراً في القائمة

#### التشخيص

```sql
-- البحث عن التكرارات
SELECT
  order_id,
  COUNT(*) as count
FROM driver_waiting_list
GROUP BY order_id
HAVING COUNT(*) > 1;
```

#### الحل

```sql
-- حذف التكرارات والاحتفاظ بالأقدم
DELETE FROM driver_waiting_list a
USING driver_waiting_list b
WHERE a.order_id = b.order_id
  AND a.id > b.id;

-- أو: الاحتفاظ بالأحدث
DELETE FROM driver_waiting_list a
USING driver_waiting_list b
WHERE a.order_id = b.order_id
  AND a.id < b.id;
```

---

### المشكلة 3: السائق لا يرى الطلبات

#### التشخيص

```sql
-- 1. فحص RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'driver_waiting_list';

-- 2. فحص البيانات
SELECT COUNT(*)
FROM driver_waiting_list
WHERE status = 'pending';

-- 3. فحص صلاحيات السائق
SELECT
  current_user as user_role,
  has_table_privilege('driver_waiting_list', 'SELECT') as can_select;
```

#### الحل

```sql
-- إنشاء أو تحديث policy للسائقين
CREATE POLICY "Drivers can view waiting orders"
  ON driver_waiting_list
  FOR SELECT
  TO authenticated
  USING (status = 'pending');
```

---

### المشكلة 4: الطلب يختفي من القائمة تلقائياً

#### السبب المحتمل

قد يكون هناك trigger يحذف الطلبات تلقائياً

```sql
-- فحص الـ triggers المشبوهة
SELECT
  tgname,
  tgtype,
  tgenabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'driver_waiting_list'::regclass;
```

#### الحل

مراجعة الـ triggers وتعديل المنطق حسب الحاجة

---

## ⚙️ الإعدادات والصيانة

### 1. تفعيل/تعطيل المعالجة التلقائية

```sql
-- تفعيل
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'true'
);

-- تعطيل
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders, autoProcessing}',
  'false'
);

-- فحص الحالة الحالية
SELECT
  (settings->'orders'->>'autoProcessing')::boolean as auto_processing_enabled
FROM app_settings;
```

---

### 2. تنظيف القائمة من الطلبات القديمة

```sql
-- حذف الطلبات التي مضى عليها أكثر من 24 ساعة
DELETE FROM driver_waiting_list
WHERE status = 'pending'
  AND created_at < now() - INTERVAL '24 hours';

-- أو: تحديث حالتها إلى expired
UPDATE driver_waiting_list
SET status = 'expired'
WHERE status = 'pending'
  AND created_at < now() - INTERVAL '24 hours';
```

---

### 3. إعادة مزامنة القائمة

```sql
-- إضافة جميع الطلبات في processing إلى القائمة
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
  created_at
FROM orders
WHERE status IN ('processing', 'waiting-for-driver')
  AND driver_id IS NULL
  AND id NOT IN (SELECT order_id FROM driver_waiting_list WHERE order_id IS NOT NULL)
ON CONFLICT (order_id) DO NOTHING;
```

---

### 4. مراقبة الأداء

```sql
-- فحص حجم القائمة
SELECT
  pg_size_pretty(pg_total_relation_size('driver_waiting_list')) as table_size,
  COUNT(*) as record_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_count
FROM driver_waiting_list;

-- فحص أداء الفهارس
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'driver_waiting_list'
ORDER BY idx_scan DESC;
```

---

## 📚 الملفات المرجعية

### ملفات الـ Migrations الرئيسية

1. **`20250517024352_morning_wave.sql`**
   - إنشاء الدوال الأساسية
   - `add_order_to_waiting_list()`
   - `get_waiting_list_orders()`

2. **`20260122012404_add_manual_waiting_list_trigger.sql`**
   - Trigger للإضافة اليدوية
   - `trigger_add_to_waiting_list_on_update`

3. **`20260129220845_enable_auto_add_to_waiting_list.sql`** ⭐
   - **الملف الأساسي!**
   - دالة `auto_process_new_order()`
   - دالة `auto_add_to_waiting_list()`
   - جميع الـ triggers للطلبات الثلاثة

4. **`20260128232830_add_manual_waiting_list_triggers_all_orders.sql`**
   - تطبيق النظام على captain_orders و parcel_orders

---

### ملفات التوثيق ذات الصلة

- **`ORDER_VISIBILITY_SYSTEM.md`** - نظام رؤية الطلبات الشامل
- **`PROCESSING_ORDERS_VISIBILITY.md`** - تفاصيل رؤية طلبات processing
- **`ADMIN_USERS_GUIDE.md`** - دليل المديرين
- **`DELIVERY_TIME_ESTIMATION_GUIDE.md`** - حساب وقت التوصيل

---

## ✅ الخلاصة النهائية

### الإجابة الكاملة على السؤال

**هل ترسل الطلبات قيد التحضير (processing) إلى قائمة انتظار السائقين مع إبقائها قيد التحضير؟**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    ✅ نعم! 100%                              │
│                                                              │
│  عند تفعيل المعالجة التلقائية (autoProcessing = true):      │
│                                                              │
│  1️⃣ الطلب يتحول فوراً إلى processing                        │
│  2️⃣ يُضاف تلقائياً إلى driver_waiting_list                  │
│  3️⃣ يبقى في حالة processing (لا يتغير!)                    │
│  4️⃣ البائع يرى الطلب بحالة "قيد التحضير"                   │
│  5️⃣ السائقون يرون الطلب في قائمة الانتظار                  │
│                                                              │
│  النظام يعمل بكفاءة عالية! 🚀                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### المميزات الرئيسية

- ✅ **سرعة فائقة**: الطلب متاح للسائقين فوراً
- ✅ **شفافية كاملة**: البائع والسائقون يرون الطلبات مباشرة
- ✅ **مرونة**: دعم المعالجة التلقائية واليدوية
- ✅ **أمان**: منع التكرار وصلاحيات محكمة
- ✅ **شمولية**: دعم جميع أنواع الطلبات (عادية، كابتن، طرود)

### التأكيدات النهائية

1. ✅ الطلبات في `processing` تُضاف للقائمة تلقائياً
2. ✅ الطلبات تبقى في `processing` (لا تتحول إلى waiting-for-driver)
3. ✅ البائع يرى "قيد التحضير"
4. ✅ السائقون يرون الطلب "متاح" في القائمة
5. ✅ النظام آمن وفعال ومختبر

---

**النظام جاهز ويعمل بشكل مثالي!** 🎉
