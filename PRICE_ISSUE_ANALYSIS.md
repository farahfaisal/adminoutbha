# تحليل مشكلة: زيادة 5 شيكل على كل طلب

## 📊 ملخص المشكلة

عند إنشاء طلب جديد، يتم **إضافة 5 شيكل إضافية** على السعر الأساسي للمنتج، مما يؤدي إلى:
- حساب خاطئ في `order_items.total`
- عدم تطابق بين `order.subtotal` و `sum(order_items.total)`

---

## 🔍 تحليل تفصيلي

### المثال المكتشف

**طلب رقم:** `ORD-817057`

#### البيانات المرسلة من العميل (في `orders.items_data`):
```json
{
  "product_name": "شاورما دجاج ع الفحم - باجيت دجاج",
  "price": 18,           ← السعر المرسل
  "quantity": 2,
  "addons": [
    {
      "name": "بطاطا صغير",
      "price": 5,
      "quantity": 1
    }
  ]
}
```

#### البيانات المحفوظة في `order_items`:
```
product_price: 23      ← تم تغيير السعر! (من 18 إلى 23)
quantity: 2
addons_data: [{"name": "بطاطا صغير", "price": 5}]
```

#### الحسابات:

| الحقل | الحساب الصحيح | الحساب الفعلي | الفرق |
|-------|---------------|---------------|-------|
| السعر الأساسي | 18 × 2 = 36 | 23 × 2 = 46 | +10 |
| الإضافات | 5 × 1 = 5 | 5 × 1 = 5 | 0 |
| **المجموع** | **41** | **51** | **+10** |

**النتيجة:**
- `order.subtotal` = 41 ✅ (محسوب بشكل صحيح)
- `order_items.total` = 51 ❌ (محسوب من السعر الخاطئ)
- **الفرق:** 10 شيكل (5 × quantity = 5 × 2)

---

## 🎯 السبب الجذري

السعر في جدول `order_items` يتم تعديله من **18 إلى 23** (زيادة 5 شيكل).

### مصادر محتملة للمشكلة:

1. **Frontend يرسل السعر خاطئ**
   - قد يكون التطبيق يضيف سعر الإضافة الافتراضية للسعر الأساسي
   - التحقق: راجع كود Frontend حيث يتم بناء `items` قبل الإرسال

2. **Trigger على `order_items`**
   - قد يوجد trigger يعدل `price` بناءً على بيانات إضافية
   - ⚠️ لم نجد trigger واضح يقوم بهذا

3. **Edge Function**
   - الكود الحالي يستخدم `item.price` مباشرة (لا يعدله)
   - ✅ Edge Function سليمة

---

## 🔧 الحل المقترح

### 1. فحص Frontend (الأولوية الأولى)

**تحقق من الكود الذي يبني `items` قبل إرساله للـ Edge Function:**

```javascript
// ابحث عن كود مشابه في Frontend
const items = products.map(product => ({
  product_id: product.id,
  product_name: product.name,
  price: product.price,        // ← تحقق من هذا السطر
  quantity: product.quantity,
  addons: selectedAddons
}));
```

**تأكد من أن:**
- `price` يحتوي على السعر الأساسي **فقط**
- الإضافات في `addons` منفصلة تماماً
- لا يتم إضافة سعر الإضافات الافتراضية (default addons) إلى `price`

### 2. استخدام سعر المنتج من قاعدة البيانات

**بدلاً من الاعتماد على السعر المرسل من العميل، اجلب السعر من قاعدة البيانات:**

```typescript
// في Edge Function: supabase/functions/create-order/index.ts
// بدلاً من استخدام item.price مباشرة:

for (const item of orderData.items) {
  // جلب السعر الفعلي من قاعدة البيانات
  const { data: product } = await supabase
    .from('products')
    .select('price')
    .eq('id', item.product_id)
    .single();

  // استخدام السعر من DB بدلاً من السعر المرسل
  const actualPrice = product?.price || item.price;

  // حساب المجموع
  calculatedSubtotal += actualPrice * item.quantity + addonsTotal;
}
```

### 3. إضافة Validation في Edge Function

```typescript
// التحقق من أن السعر المرسل يطابق السعر في قاعدة البيانات
const { data: product } = await supabase
  .from('products')
  .select('price')
  .eq('id', item.product_id)
  .single();

if (product && Math.abs(product.price - item.price) > 0.01) {
  console.warn(`Price mismatch for product ${item.product_id}:
    Sent: ${item.price}, Actual: ${product.price}`);

  // استخدام السعر الفعلي
  item.price = product.price;
}
```

---

## 🧪 التحقق من الحل

### 1. إنشاء طلب اختباري

```javascript
const testOrder = {
  customer_name: 'اختبار',
  customer_phone: '0501234567',
  vendor_id: 'vendor-uuid',
  service_area_id: 'area-uuid',
  address: 'عنوان تجريبي',
  city: 'المدينة',
  items: [
    {
      product_id: 'product-uuid',
      product_name: 'منتج تجريبي',
      price: 20,        // سعر ثابت معروف
      quantity: 1,
      addons: [
        {
          id: 'addon-uuid',
          name: 'إضافة تجريبية',
          price: 3,
          quantity: 1
        }
      ]
    }
  ],
  delivery_fee: 10
};

// المتوقع:
// - subtotal = (20 × 1) + (3 × 1) = 23
// - total = 23 + 10 = 33
```

### 2. التحقق من النتائج

```sql
-- بعد إنشاء الطلب
SELECT
  o.order_number,
  o.subtotal as expected_23,
  o.total as expected_33,
  oi.price as should_be_20,
  oi.quantity,
  oi.total as should_be_23,
  (oi.price - 20) as price_difference
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.order_number = 'رقم-الطلب-التجريبي';
```

---

## 📋 قائمة التحقق

- [ ] فحص كود Frontend الذي يبني `items`
- [ ] التأكد من عدم إضافة سعر الإضافات الافتراضية إلى `price`
- [ ] إضافة validation في Edge Function
- [ ] استخدام أسعار قاعدة البيانات بدلاً من الأسعار المرسلة
- [ ] إنشاء طلب اختباري والتحقق من الحسابات
- [ ] إصلاح الطلبات الموجودة (إن وجدت)

---

## 💡 توصيات إضافية

### 1. **لا تثق في الأسعار من Frontend**
   - العميل يمكنه تعديل أي بيانات يرسلها
   - احصل دائماً على الأسعار من قاعدة البيانات

### 2. **سجل جميع التغييرات**
   ```javascript
   console.log('Price Check:', {
     sent: item.price,
     actual: product.price,
     difference: item.price - product.price
   });
   ```

### 3. **أضف unit tests**
   - اختبر حساب الأسعار بسيناريوهات مختلفة
   - تأكد من صحة المعادلات

### 4. **راقب الطلبات الجديدة**
   ```sql
   -- استعلام للمراقبة
   SELECT
     order_number,
     subtotal,
     (SELECT SUM(total) FROM order_items WHERE order_id = orders.id) as items_sum,
     (subtotal - (SELECT SUM(total) FROM order_items WHERE order_id = orders.id)) as difference
   FROM orders
   WHERE created_at > NOW() - INTERVAL '1 hour'
   HAVING difference != 0;
   ```

---

## 🚨 ملاحظة مهمة

**الأسعار في جدول `order_items` يجب أن تكون:**
- السعر الأساسي **فقط** (بدون إضافات)
- مطابقة للسعر في جدول `products` وقت الطلب
- الإضافات تُحفظ في `addons_data` منفصلة

**المعادلة الصحيحة:**
```
item.total = (item.price × item.quantity) + sum(addon.price × addon.quantity)
```

حيث:
- `item.price` = السعر الأساسي من قاعدة البيانات
- `addon.price` = سعر الإضافة من قاعدة البيانات
- **لا يجب** جمع الإضافات مع السعر الأساسي في حقل `price`
