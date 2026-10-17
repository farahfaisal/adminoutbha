# دليل إنشاء الطلبات من تطبيق الزبون

## نظرة عامة

لإنشاء طلبات جديدة من تطبيق الزبون، يجب استخدام **Edge Function** المخصصة لذلك بدلاً من الإدراج المباشر في قاعدة البيانات.

## لماذا Edge Function؟

- **الأمان**: RLS مفعّل على جدول `orders` لحماية البيانات
- **الصلاحيات**: Edge Function تستخدم `service_role_key` لتجاوز RLS
- **المعالجة**: تقوم بحساب الإجماليات والتحقق من البيانات تلقائياً
- **Triggers**: تشغل جميع الـ triggers اللازمة بشكل صحيح

## الاستخدام

### 1. معلومات Edge Function

- **URL**: `https://[PROJECT_ID].supabase.co/functions/v1/create-order`
- **الطريقة**: POST
- **المصادقة**: استخدام anon key (موجود في `.env`)

### 2. مثال على الطلب

```javascript
const createOrder = async (orderData) => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        customer_name: 'محمد أحمد',
        customer_phone: '0501234567',
        vendor_id: 'uuid-of-vendor',
        service_area_id: 'uuid-of-service-area',
        address: 'شارع الملك فهد، الرياض',
        city: 'الرياض',
        latitude: 24.7136,
        longitude: 46.6753,
        items: [
          {
            product_id: 'uuid-of-product',
            product_name: 'بيتزا مارغريتا',
            quantity: 2,
            price: 45,
            addons: [
              {
                id: 'addon-uuid',
                name: 'جبنة إضافية',
                price: 5,
                quantity: 1
              }
            ]
          }
        ],
        subtotal: 0, // سيتم حسابه تلقائياً
        delivery_fee: 10,
        total: 0, // سيتم حسابه تلقائياً
        payment_method: 'cash',
        notes: 'ملاحظات خاصة',
        delivery_instructions: 'الدور الثاني - شقة 5'
      })
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log('تم إنشاء الطلب:', result.order);
    return result.order;
  } else {
    console.error('خطأ:', result.error);
    throw new Error(result.error);
  }
};
```

### 3. البيانات المطلوبة

#### الحقول الإجبارية
- `customer_name`: اسم الزبون
- `customer_phone`: رقم الهاتف
- `vendor_id`: معرف المتجر
- `service_area_id`: معرف منطقة الخدمة
- `address`: العنوان الكامل
- `city`: المدينة
- `items`: قائمة المنتجات (array)
  - `product_id`: معرف المنتج
  - `product_name`: اسم المنتج
  - `quantity`: الكمية
  - `price`: السعر

#### الحقول الاختيارية
- `latitude`: خط العرض (لحساب رسوم التوصيل)
- `longitude`: خط الطول (لحساب رسوم التوصيل)
- `payment_method`: طريقة الدفع (افتراضي: 'cash')
- `notes`: ملاحظات
- `delivery_instructions`: تعليمات التوصيل
- `is_scheduled`: طلب مجدول (افتراضي: false)
- `scheduled_time`: وقت التوصيل المجدول

### 4. معالجة الإضافات (Addons)

كل منتج يمكن أن يحتوي على إضافات:

```javascript
{
  product_id: 'uuid',
  product_name: 'برجر',
  quantity: 1,
  price: 30,
  addons: [
    {
      id: 'addon-1',
      name: 'بطاطس',
      price: 10,
      quantity: 1
    },
    {
      id: 'addon-2',
      name: 'صوص حار',
      price: 2,
      quantity: 2
    }
  ]
}
```

**حساب السعر:**
- السعر الأساسي = `price × quantity` = 30 × 1 = 30
- سعر الإضافات = (10 × 1) + (2 × 2) = 14
- الإجمالي = 30 + 14 = 44

### 5. الاستجابة

#### نجاح الطلب
```json
{
  "success": true,
  "message": "تم إنشاء الطلب بنجاح",
  "order": {
    "id": "uuid",
    "order_number": "ORD-1234567890-123",
    "status": "pending",
    "total": 105,
    ...
  }
}
```

#### فشل الطلب
```json
{
  "error": "رسالة الخطأ",
  "details": "تفاصيل إضافية"
}
```

### 6. الحالة الافتراضية

جميع الطلبات الجديدة تبدأ بحالة `pending` ولا يراها:
- ❌ البائعون
- ❌ السائقون
- ✅ المديرون فقط (للموافقة)

بعد الموافقة من المدير، تتحول الحالة إلى `accepted` وتصبح مرئية للبائع.

## أمثلة عملية

### مثال 1: طلب بسيط

```javascript
await createOrder({
  customer_name: 'علي محمد',
  customer_phone: '0501234567',
  vendor_id: 'vendor-uuid',
  service_area_id: 'area-uuid',
  address: 'شارع الملك عبدالعزيز',
  city: 'جدة',
  items: [
    {
      product_id: 'product-uuid',
      product_name: 'شاورما',
      quantity: 3,
      price: 15
    }
  ],
  delivery_fee: 10,
  payment_method: 'cash'
});
```

### مثال 2: طلب مع إضافات ومواقع

```javascript
await createOrder({
  customer_name: 'فاطمة أحمد',
  customer_phone: '0559876543',
  vendor_id: 'vendor-uuid',
  service_area_id: 'area-uuid',
  address: 'حي النهضة، شارع التحلية',
  city: 'الرياض',
  latitude: 24.7136,
  longitude: 46.6753,
  items: [
    {
      product_id: 'product-1',
      product_name: 'بيتزا',
      quantity: 2,
      price: 50,
      addons: [
        { id: 'addon-1', name: 'جبنة', price: 10, quantity: 1 }
      ]
    },
    {
      product_id: 'product-2',
      product_name: 'مشروب',
      quantity: 2,
      price: 5
    }
  ],
  delivery_fee: 15,
  payment_method: 'online',
  notes: 'بدون بصل من فضلك',
  delivery_instructions: 'الرجاء الاتصال عند الوصول'
});
```

## التحقق من الصحة

Edge Function تقوم بالتحقق من:

1. ✅ وجود البيانات المطلوبة
2. ✅ وجود المتجر ونشاطه
3. ✅ وجود منطقة الخدمة ونشاطها
4. ✅ أن المتجر يوصّل لهذه المنطقة
5. ✅ حساب الإجماليات بشكل صحيح
6. ✅ تطبيق عروض التوصيل (إن وجدت)

## الأخطاء الشائعة

| الخطأ | السبب | الحل |
|-------|-------|------|
| "اسم الزبون ورقم الهاتف مطلوبان" | بيانات ناقصة | تأكد من إرسال جميع الحقول المطلوبة |
| "المتجر غير موجود" | vendor_id خاطئ | تحقق من معرف المتجر |
| "المتجر غير نشط حالياً" | المتجر معطل | اختر متجر آخر |
| "المتجر لا يقدم خدمة التوصيل لهذه المنطقة" | منطقة غير مدعومة | اختر منطقة أخرى أو متجر آخر |
| "يجب إضافة منتج واحد على الأقل" | قائمة المنتجات فارغة | أضف منتجات للطلب |

## ملاحظات مهمة

1. **لا تستخدم الإدراج المباشر**: استخدام `supabase.from('orders').insert()` سيفشل بسبب RLS
2. **استخدم Edge Function دائماً**: هي الطريقة الآمنة والموصى بها
3. **لا تحسب الإجماليات يدوياً**: Edge Function تحسبها تلقائياً
4. **وفر الموقع إن أمكن**: لحساب رسوم التوصيل بدقة

## الدعم

لأي استفسارات أو مشاكل، راجع:
- ملف `supabase/functions/create-order/index.ts`
- سجلات Edge Function في Supabase Dashboard
