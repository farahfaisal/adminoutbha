# دليل نظام حساب وقت التوصيل المتوقع

## نظرة عامة

تم تطوير نظام متقدم لحساب وقت التوصيل المتوقع بناءً على موقع المتجر وموقع العميل. يستخدم النظام الإحداثيات الجغرافية (GPS) لحساب المسافة والوقت بدقة.

## المكونات الرئيسية

### 1. حاسبة المسافة والوقت
**الملف:** `src/utils/deliveryTimeCalculator.js`

#### الوظائف المتاحة:

##### `calculateDistance(lat1, lon1, lat2, lon2)`
- حساب المسافة بين نقطتين باستخدام صيغة Haversine
- **المدخلات:** إحداثيات نقطتين (خطوط العرض والطول)
- **المخرجات:** المسافة بالكيلومتر

##### `calculateEstimatedDeliveryTime(vendorLat, vendorLng, customerLat, customerLng, options)`
- حساب وقت التوصيل المتوقع الكامل
- **المدخلات:**
  - موقع المتجر (latitude, longitude)
  - موقع العميل (latitude, longitude)
  - خيارات اختيارية:
    - `averageSpeedKmh`: متوسط السرعة (افتراضي: 30 كم/ساعة)
    - `preparationTimeMinutes`: وقت تحضير الطلب (افتراضي: 15 دقيقة)
    - `bufferTimeMinutes`: وقت إضافي للتأخيرات (افتراضي: 5 دقائق)
- **المخرجات:**
  ```javascript
  {
    distanceKm: 5.2,
    travelTimeMinutes: 10,
    preparationTimeMinutes: 15,
    bufferTimeMinutes: 5,
    totalTimeMinutes: 30,
    estimatedDeliveryTime: "30 دقيقة"
  }
  ```

##### `getDeliveryTimeRange(totalMinutes)`
- حساب نطاق زمني للتوصيل (min-max)
- **المدخلات:** إجمالي الدقائق
- **المخرجات:**
  ```javascript
  {
    min: "30 دقيقة",
    max: "40 دقيقة",
    range: "30 دقيقة - 40 دقيقة"
  }
  ```

##### `canDeliver(vendorLat, vendorLng, customerLat, customerLng, maxRadiusKm)`
- التحقق من إمكانية التوصيل ضمن نطاق معين
- **المدخلات:** مواقع المتجر والعميل + النطاق الأقصى
- **المخرجات:** true/false

### 2. واجهة برمجية للتوصيل (API)
**الملف:** `src/lib/deliveryEstimateApi.js`

#### الوظائف المتاحة:

##### `calculateDeliveryEstimate(vendorId, customerLat, customerLng)`
- حساب وقت التوصيل لمتجر معين
- **الاستخدام:**
  ```javascript
  const result = await calculateDeliveryEstimate('vendor-uuid', 31.5017, 34.4668);
  if (result.success) {
    console.log(result.estimate.totalTimeMinutes);
    console.log(result.canDeliver);
  }
  ```

##### `getVendorsWithDeliveryEstimates(customerLat, customerLng, filters)`
- جلب قائمة المتاجر مع أوقات التوصيل المتوقعة
- **الفلاتر:**
  - `categoryId`: تصنيف معين
  - `maxDistance`: أقصى مسافة بالكيلومتر
  - `sortBy`: الترتيب ('distance' أو 'time')
- **الاستخدام:**
  ```javascript
  const result = await getVendorsWithDeliveryEstimates(31.5017, 34.4668, {
    maxDistance: 10,
    sortBy: 'time'
  });
  ```

##### `updateVendorLocation(vendorId, latitude, longitude)`
- تحديث موقع المتجر
- **الاستخدام:**
  ```javascript
  const result = await updateVendorLocation('vendor-uuid', 31.5017, 34.4668);
  ```

### 3. مكون عرض وقت التوصيل
**الملف:** `src/components/Orders/DeliveryTimeEstimate.jsx`

مكون React لعرض معلومات التوصيل المتوقع بشكل جميل ومنسق.

**الاستخدام:**
```jsx
import DeliveryTimeEstimate from './components/Orders/DeliveryTimeEstimate';

<DeliveryTimeEstimate
  vendor={{
    latitude: 31.5017,
    longitude: 34.4668,
    estimated_delivery_time: 20
  }}
  customerAddress={{
    latitude: 31.5234,
    longitude: 34.4512
  }}
/>
```

## تكامل مع نموذج المتجر

### تحديد موقع المتجر
في صفحة إضافة/تعديل المتجر (`VendorForm.jsx`):

1. **استخدم موقعي الحالي**: يطلب أذونات الموقع ويحدد موقعك تلقائياً
2. **تحديد على الخريطة**: انقر أو اسحب العلامة لتحديد الموقع
3. **الإحداثيات المحفوظة**: يتم حفظ latitude و longitude تلقائياً في قاعدة البيانات

### تخزين البيانات
يتم حفظ البيانات التالية في جدول `vendors`:
- `latitude`: خط العرض (NUMERIC)
- `longitude`: خط الطول (NUMERIC)
- `estimated_delivery_time`: وقت التحضير بالدقائق (INTEGER)
- `delivery_radius`: نطاق التوصيل بالكيلومتر (NUMERIC)

## أمثلة عملية

### مثال 1: حساب وقت توصيل بسيط
```javascript
import { calculateEstimatedDeliveryTime } from './utils/deliveryTimeCalculator';

const estimate = calculateEstimatedDeliveryTime(
  31.5017, 34.4668,  // موقع المتجر
  31.5234, 34.4512   // موقع العميل
);

console.log(`المسافة: ${estimate.distanceKm} كم`);
console.log(`الوقت المتوقع: ${estimate.estimatedDeliveryTime}`);
```

### مثال 2: التحقق من إمكانية التوصيل
```javascript
import { canDeliver } from './utils/deliveryTimeCalculator';

const canWeDeliver = canDeliver(
  31.5017, 34.4668,  // موقع المتجر
  31.5234, 34.4512,  // موقع العميل
  10                  // نطاق أقصى 10 كم
);

if (!canWeDeliver) {
  alert('عذراً، هذا العنوان خارج نطاق التوصيل');
}
```

### مثال 3: جلب أقرب المتاجر
```javascript
import { getVendorsWithDeliveryEstimates } from './lib/deliveryEstimateApi';

const result = await getVendorsWithDeliveryEstimates(
  31.5017, 34.4668,
  {
    maxDistance: 5,      // 5 كم فقط
    sortBy: 'distance'   // ترتيب حسب الأقرب
  }
);

result.vendors.forEach(vendor => {
  console.log(`${vendor.store_name}: ${vendor.estimate.distanceKm} كم`);
});
```

## معادلة حساب الوقت

```
الوقت الكلي = وقت التحضير + وقت التوصيل + الوقت الإضافي
```

حيث:
- **وقت التحضير**: من إعدادات المتجر (`estimated_delivery_time`)
- **وقت التوصيل**: `(المسافة ÷ متوسط السرعة) × 60`
- **الوقت الإضافي**: buffer للتأخيرات المحتملة

## معلومات هامة

### دقة الحسابات
- استخدام صيغة Haversine لحساب المسافة الجوية (As the crow flies)
- المسافة الفعلية قد تكون أطول بسبب الطرق
- متوسط السرعة الافتراضي: 30 كم/ساعة (مناسب لحركة المدينة)

### متطلبات التشغيل
1. موقع المتجر يجب أن يكون محدداً (latitude & longitude)
2. موقع العميل يجب أن يكون متاحاً
3. المتصفح يجب أن يدعم Geolocation API

### أذونات الموقع
عند فتح الخريطة:
- يطلب النظام أذونات الموقع من المتصفح
- في حالة الرفض: يستخدم موقع افتراضي (فلسطين)
- يمكن إعادة طلب الأذونات من إعدادات المتصفح

## استكشاف الأخطاء

### المشكلة: "موقع المتجر غير محدد"
**الحل:** تأكد من تحديد موقع المتجر على الخريطة في صفحة تعديل المتجر

### المشكلة: "خارج نطاق التوصيل"
**الحل:** زيادة `delivery_radius` في إعدادات المتجر

### المشكلة: الوقت المحسوب غير دقيق
**الحل:** تعديل:
- `estimated_delivery_time` (وقت التحضير)
- `averageSpeedKmh` في options
- `bufferTimeMinutes` للوقت الإضافي

## التطوير المستقبلي

يمكن تطوير النظام لإضافة:
1. حساب المسافة الفعلية باستخدام Google Directions API
2. احتساب حركة المرور الحية
3. مناطق توصيل معقدة (Polygons)
4. تكلفة توصيل ديناميكية حسب المسافة والوقت
5. إشعارات للعملاء بوقت التوصيل المتوقع

## الدعم

للمزيد من المعلومات أو المساعدة:
- راجع الكود المصدري في المسارات المذكورة
- تحقق من console.log للأخطاء
- تأكد من أن المتصفح يدعم Geolocation API
