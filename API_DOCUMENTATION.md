# توثيق API لإنشاء الطلبات

## نظرة عامة
تم إنشاء Edge Function لاستقبال الطلبات من تطبيق الزبون مع التحقق الكامل من صحة البيانات والأمان.

---

## Endpoint

### إنشاء طلب جديد

**URL:**
```
POST https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/create-order
```

**Headers:**
```
Content-Type: application/json
apikey: YOUR_SUPABASE_ANON_KEY
```

**طريقة الوصول للـ ANON_KEY:**
من الـ `.env` في المشروع:
```
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Request Body

### الحقول المطلوبة (Required)

```json
{
  "customer_name": "string",          // اسم الزبون
  "customer_phone": "string",         // رقم هاتف الزبون
  "vendor_id": "uuid",                // معرف المتجر
  "service_area_id": "uuid",          // معرف منطقة الخدمة
  "address": "string",                // عنوان التوصيل
  "city": "string",                   // المدينة
  "items": [                          // قائمة المنتجات
    {
      "product_id": "uuid",
      "product_name": "string",
      "quantity": number,
      "price": number,
      "variant_id": "uuid",           // اختياري
      "variant_name": "string",       // اختياري
      "addons": [                     // اختياري
        {
          "id": "uuid",
          "name": "string",
          "price": number
        }
      ]
    }
  ],
  "subtotal": number,                 // المجموع الفرعي
  "delivery_fee": number,             // رسوم التوصيل
  "total": number                     // المجموع الكلي
}
```

### الحقول الاختيارية (Optional)

```json
{
  "latitude": number,                 // خط العرض
  "longitude": number,                // خط الطول
  "payment_method": "string",         // طريقة الدفع (افتراضي: "cash")
  "notes": "string",                  // ملاحظات الطلب
  "delivery_instructions": "string",  // تعليمات التوصيل
  "is_scheduled": boolean,            // هل الطلب مجدول؟
  "scheduled_time": "string"          // وقت التوصيل المجدول (ISO 8601)
}
```

---

## Response

### نجاح العملية (200)

```json
{
  "success": true,
  "message": "تم إنشاء الطلب بنجاح",
  "order": {
    "id": "uuid",
    "order_number": "ORD-1234567890-123",
    "customer_name": "محمد أحمد",
    "customer_phone": "0599123456",
    "vendor_id": "uuid",
    "vendor_name": "مطعم البلد",
    "service_area_id": "uuid",
    "address": "شارع المنارة، بناية 5",
    "city": "رام الله",
    "status": "pending",
    "total": 75.50,
    "subtotal": 65.00,
    "delivery_fee": 10.50,
    "payment_method": "cash",
    "items_data": [...],
    "created_at": "2025-12-27T10:30:00Z",
    "preparation_time": 20
  }
}
```

### أخطاء محتملة (400/500)

```json
{
  "error": "رسالة الخطأ بالعربية",
  "details": "تفاصيل إضافية (اختياري)"
}
```

---

## رسائل الأخطاء

| الخطأ | السبب |
|-------|-------|
| اسم الزبون ورقم الهاتف مطلوبان | لم يتم إرسال اسم العميل أو رقم الهاتف |
| معرف المتجر مطلوب | لم يتم إرسال vendor_id |
| منطقة الخدمة مطلوبة | لم يتم إرسال service_area_id |
| يجب إضافة منتج واحد على الأقل | قائمة items فارغة |
| منطقة الخدمة غير موجودة | service_area_id غير صحيح |
| منطقة الخدمة غير نشطة حالياً | المنطقة معطلة |
| المتجر غير موجود | vendor_id غير صحيح |
| المتجر غير نشط حالياً | المتجر معطل |
| المتجر لا يقدم خدمة التوصيل لهذه المنطقة | المتجر غير مسجل في هذه المنطقة |
| فشل في إنشاء الطلب | خطأ في قاعدة البيانات |

---

## مثال عملي

### مثال 1: طلب بسيط

```javascript
const createOrder = async () => {
  const orderData = {
    customer_name: "أحمد محمد",
    customer_phone: "0599123456",
    vendor_id: "123e4567-e89b-12d3-a456-426614174000",
    service_area_id: "987fcdeb-51a2-43d7-b123-987654321000",
    address: "شارع الإرسال، بناية 10",
    city: "الخليل",
    latitude: 31.5326,
    longitude: 35.0998,
    items: [
      {
        product_id: "abc12345-1234-1234-1234-123456789abc",
        product_name: "منسف لحم",
        quantity: 2,
        price: 45.00
      },
      {
        product_id: "def67890-5678-5678-5678-567890123def",
        product_name: "سلطة فتوش",
        quantity: 1,
        price: 12.00
      }
    ],
    subtotal: 102.00,
    delivery_fee: 8.00,
    total: 110.00,
    payment_method: "cash",
    notes: "يرجى عدم إضافة بصل"
  };

  try {
    const response = await fetch(
      'https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/create-order',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify(orderData)
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log('تم إنشاء الطلب:', result.order);
      console.log('رقم الطلب:', result.order.order_number);
    } else {
      console.error('خطأ:', result.error);
    }
  } catch (error) {
    console.error('خطأ في الاتصال:', error);
  }
};
```

### مثال 2: طلب مجدول مع إضافات

```javascript
const createScheduledOrder = async () => {
  const orderData = {
    customer_name: "سارة علي",
    customer_phone: "0598765432",
    vendor_id: "123e4567-e89b-12d3-a456-426614174000",
    service_area_id: "987fcdeb-51a2-43d7-b123-987654321000",
    address: "شارع النصر، شقة 5",
    city: "نابلس",
    items: [
      {
        product_id: "xyz12345-abcd-efgh-ijkl-123456789xyz",
        product_name: "بيتزا مارغريتا",
        quantity: 1,
        price: 35.00,
        variant_id: "var12345-1234-1234-1234-variant123456",
        variant_name: "حجم كبير",
        addons: [
          {
            id: "addon001",
            name: "جبنة إضافية",
            price: 5.00
          },
          {
            id: "addon002",
            name: "زيتون",
            price: 3.00
          }
        ]
      }
    ],
    subtotal: 43.00,
    delivery_fee: 7.00,
    total: 50.00,
    payment_method: "cash",
    is_scheduled: true,
    scheduled_time: "2025-12-27T18:00:00Z",
    delivery_instructions: "يرجى الاتصال عند الوصول"
  };

  // نفس طريقة الإرسال السابقة
};
```

---

## الحصول على service_area_id

### الخطوة 1: جلب قائمة المناطق المتاحة

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fliwyntfvfedslbwkvks.supabase.co',
  'YOUR_SUPABASE_ANON_KEY'
);

// جلب المناطق النشطة
const { data: serviceAreas, error } = await supabase
  .from('service_areas')
  .select('id, name, city, delivery_price, parent_id')
  .eq('is_active', true)
  .order('city', { ascending: true });

console.log('المناطق المتاحة:', serviceAreas);
```

### الخطوة 2: التحقق من المتاجر المتاحة في المنطقة

```javascript
const getVendorsInArea = async (serviceAreaId) => {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select(`
      id,
      name,
      estimated_delivery_time,
      vendor_service_areas!inner (
        service_area_id,
        custom_delivery_price
      )
    `)
    .eq('is_active', true)
    .eq('vendor_service_areas.service_area_id', serviceAreaId);

  return vendors;
};
```

---

## Flow كامل لإنشاء طلب

```javascript
// 1. اختيار المنطقة
const selectServiceArea = async (city) => {
  const { data: areas } = await supabase
    .from('service_areas')
    .select('*')
    .eq('city', city)
    .eq('is_active', true);

  return areas;
};

// 2. اختيار المتجر
const selectVendor = async (serviceAreaId) => {
  const vendors = await getVendorsInArea(serviceAreaId);
  return vendors;
};

// 3. إضافة المنتجات إلى السلة
const cart = [];
cart.push({
  product_id: "...",
  product_name: "...",
  quantity: 2,
  price: 45.00
});

// 4. حساب المجموع
const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const deliveryFee = 10.00; // من vendor_service_areas أو service_areas
const total = subtotal + deliveryFee;

// 5. إنشاء الطلب
const orderData = {
  customer_name: "...",
  customer_phone: "...",
  vendor_id: selectedVendor.id,
  service_area_id: selectedArea.id,
  address: "...",
  city: selectedArea.city,
  items: cart,
  subtotal,
  delivery_fee: deliveryFee,
  total
};

// 6. إرسال الطلب
const response = await fetch('https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify(orderData)
});

const result = await response.json();
```

---

## ملاحظات مهمة

### 1. الأمان
- ✅ يتم التحقق من صحة جميع البيانات
- ✅ يتم التحقق من أن المنطقة نشطة
- ✅ يتم التحقق من أن المتجر نشط
- ✅ يتم التحقق من أن المتجر يخدم المنطقة المحددة

### 2. رقم الطلب
- يتم توليده تلقائياً بصيغة: `ORD-{timestamp}-{random}`
- مثال: `ORD-1735294200000-456`

### 3. وقت التحضير
- يتم أخذه من إعدادات المتجر (`estimated_delivery_time`)
- القيمة الافتراضية: 20 دقيقة

### 4. CORS
- الـ Edge Function تدعم CORS بالكامل
- يمكن الوصول إليها من أي domain

### 5. معالجة الأخطاء
- جميع الأخطاء تُرجع رسائل بالعربية
- يتم تسجيل الأخطاء التقنية في logs

---

## الدعم والمساعدة

للمزيد من المساعدة أو الإبلاغ عن مشاكل:
- راجع ملف `SERVICE_AREA_MANAGERS.md` للمزيد عن نظام المناطق
- راجع ملف `APPLY_SERVICE_AREAS_MIGRATION.md` لمعرفة بنية المناطق

---

## Changelog

### v1.0 - 2025-12-27
- ✅ إنشاء Edge Function لاستقبال الطلبات
- ✅ إضافة validation كامل للبيانات
- ✅ دعم المناطق الفرعية (service_areas)
- ✅ التحقق من توفر المتجر في المنطقة
- ✅ رسائل خطأ بالعربية
- ✅ توليد رقم طلب تلقائي
