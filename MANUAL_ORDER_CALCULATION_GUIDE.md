# دليل الحساب اليدوي للطلبات

## التغييرات التي تمت

تم **إزالة الحساب التلقائي** للمبلغ الإجمالي (total) عند إنشاء أو تعديل order_items. الآن يمكن تحديد قيمة `total` يدوياً.

### ما تم إلغاؤه:

✅ **تم حذف trigger** `order_item_total_trigger` الذي كان يحسب المبلغ تلقائياً
✅ **تم حذف function** `update_order_item_total()` التي كانت تُستدعى من trigger

### ما تم الاحتفاظ به:

✅ **Function الحساب** `calculate_order_item_total()` - متاحة للاستخدام اليدوي إذا احتجتها

---

## كيفية إنشاء طلب الآن

### الطريقة 1: تحديد total يدوياً (موصى بها)

عند إنشاء طلب عبر API، احسب `total` مباشرة وأرسله:

```javascript
// مثال: إنشاء order_item
const orderItem = {
  order_id: orderId,
  product_id: productId,
  price: 10,          // سعر المنتج الأساسي
  quantity: 5,        // الكمية
  addons_data: [      // الإضافات
    { id: 1, name: 'بيض', price: 5, quantity: 2 },
    { id: 2, name: 'بيكن', price: 7, quantity: 2 }
  ],
  total: 74           // المبلغ الإجمالي المحسوب مباشرة
};

// الحساب: (10 × 5) + (5×2 + 7×2) = 50 + (10 + 14) = 50 + 24 = 74

const { data, error } = await supabase
  .from('order_items')
  .insert(orderItem);
```

### الطريقة 2: استخدام function الحساب (إذا احتجت)

إذا أردت استخدام function قاعدة البيانات للحساب:

```sql
-- حساب total لمنتج محدد
SELECT calculate_order_item_total(
  10,                    -- price: سعر المنتج
  5,                     -- quantity: الكمية
  '[
    {"id": 1, "name": "بيض", "price": 5, "quantity": 2},
    {"id": 2, "name": "بيكن", "price": 7, "quantity": 2}
  ]'::jsonb              -- addons_data: الإضافات
);
-- النتيجة: 74 شيكل = (10 × 5) + (5×2 + 7×2)
```

### الطريقة 3: تحديث total بعد الإنشاء

```sql
-- إنشاء order_item ثم تحديث total
INSERT INTO order_items (order_id, product_id, price, quantity, addons_data)
VALUES ('order-123', 'product-456', 32, 3, '[...]'::jsonb);

-- تحديث total يدوياً
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE order_id = 'order-123';
```

---

## صيغة الحساب

```
total = (price × quantity) + sum_of_addons

حيث:
  sum_of_addons = Σ (addon.price × addon.quantity)
```

### مثال عملي:

```
المنتج: مشروب (10 شيكل)
الإضافات:
  - بيض: 5 شيكل × 2 = 10 شيكل
  - بيكن: 7 شيكل × 2 = 14 شيكل
الكمية: 5

الحساب:
  sum_of_addons = 10 + 14 = 24 شيكل
  total = (10 × 5) + 24 = 50 + 24 = 74 شيكل

❌ الطريقة الخاطئة: (10 + 24) × 5 = 170 شيكل
✅ الطريقة الصحيحة: (10 × 5) + 24 = 74 شيكل
```

**ملاحظة مهمة:** الإضافات لا تُضرب في كمية المنتج!

---

## تحديث الطلبات القديمة

إذا كانت لديك طلبات قديمة بدون `total` صحيح، يمكنك تحديثها:

```sql
-- تحديث جميع order_items بحساب total الصحيح
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data);

-- تحديث طلب محدد فقط
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE order_id = 'specific-order-id';
```

---

## Edge Function: create-order

تأكد من أن edge function الخاص بإنشاء الطلبات يحسب `total` قبل إدراج البيانات:

```typescript
// في supabase/functions/create-order/index.ts

function calculateItemTotal(item) {
  let addonsSum = 0;

  if (item.addons && item.addons.length > 0) {
    addonsSum = item.addons.reduce((sum, addon) => {
      return sum + (addon.price * (addon.quantity || 1));
    }, 0);
  }

  // مهم: الإضافات لا تُضرب في كمية المنتج!
  // الصحيح: (سعر المنتج × الكمية) + الإضافات
  // الخطأ: (سعر المنتج + الإضافات) × الكمية
  return (item.price * item.quantity) + addonsSum;
}

// عند إنشاء order_items
const orderItems = items.map(item => ({
  ...item,
  total: calculateItemTotal(item)
}));
```

---

## الفوائد من الحساب اليدوي

1. **مرونة أكبر**: يمكن تعديل الأسعار حسب الحاجة
2. **تحكم كامل**: API يتحكم في المبلغ النهائي
3. **تجنب التغييرات غير المتوقعة**: لن يتم إعادة حساب المبلغ تلقائياً
4. **دعم العروض والخصومات**: يمكن تطبيق خصومات مخصصة
5. **أداء أفضل**: عدم تشغيل trigger عند كل عملية

---

## ملاحظات مهمة

⚠️ **تأكد من حساب total بشكل صحيح في التطبيق أو API**

⚠️ **القيمة الافتراضية لـ total = 0** إذا لم يتم تحديدها

✅ **Function الحساب** `calculate_order_item_total()` **لا تزال متاحة** للاستخدام اليدوي

✅ **لن يؤثر هذا على الطلبات الموجودة** - فقط الطلبات الجديدة

---

## استعلامات مفيدة

### التحقق من الطلبات بدون total
```sql
SELECT id, order_id, product_id, price, quantity, total
FROM order_items
WHERE total = 0 OR total IS NULL;
```

### حساب إجمالي الطلب
```sql
SELECT
  order_id,
  SUM(total) as items_total,
  COUNT(*) as items_count
FROM order_items
GROUP BY order_id;
```

### التحقق من صحة الحسابات
```sql
SELECT
  id,
  total as stored_total,
  calculate_order_item_total(price, quantity, addons_data) as calculated_total,
  total - calculate_order_item_total(price, quantity, addons_data) as difference
FROM order_items
WHERE total != calculate_order_item_total(price, quantity, addons_data);
```
