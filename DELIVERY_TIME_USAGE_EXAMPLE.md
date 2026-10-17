# أمثلة عملية لاستخدام نظام وقت التوصيل

## 1. في صفحة إضافة/تعديل متجر

عند إضافة أو تعديل متجر، يجب تحديد موقعه على الخريطة:

### الخطوات:
1. اذهب إلى صفحة "إضافة بائع" أو "تعديل بائع"
2. انتقل إلى قسم "موقع المتجر"
3. انقر على "استخدم موقعي الحالي" لتحديد موقعك الحالي تلقائياً
   - سيطلب المتصفح أذونات الموقع
   - بعد الموافقة، سيتم تحديد موقعك على الخريطة
4. أو قم بالنقر/السحب على الخريطة لتحديد الموقع يدوياً
5. سيتم حفظ latitude و longitude تلقائياً

### النتيجة:
```javascript
{
  store_name: "مطعم الزعيم",
  latitude: 31.5017,
  longitude: 34.4668,
  estimated_delivery_time: 30  // دقيقة
}
```

## 2. عرض وقت التوصيل في صفحة الطلب

### في `OrderDetails.jsx` أو `Orders.jsx`:

```jsx
import DeliveryTimeEstimate from '../components/Orders/DeliveryTimeEstimate';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function OrderDetails({ order }) {
  const [vendor, setVendor] = useState(null);

  useEffect(() => {
    const fetchVendor = async () => {
      const { data } = await supabase
        .from('vendors')
        .select('id, store_name, latitude, longitude, estimated_delivery_time')
        .eq('id', order.vendor_id)
        .single();

      setVendor(data);
    };

    fetchVendor();
  }, [order.vendor_id]);

  return (
    <div className="order-details">
      <h2>تفاصيل الطلب #{order.order_number}</h2>

      {/* معلومات الطلب الأخرى */}

      {vendor && order.address_latitude && order.address_longitude && (
        <DeliveryTimeEstimate
          vendor={vendor}
          customerAddress={{
            latitude: order.address_latitude,
            longitude: order.address_longitude
          }}
        />
      )}
    </div>
  );
}
```

### المخرجات المتوقعة:

سيعرض مربع جميل يحتوي على:
- ⏱️ وقت التوصيل المتوقع: 25 - 35 دقيقة
- 📍 المسافة: 3.5 كم
- 🚗 زمن النقل: 7 دقائق
- تفاصيل التقسيم:
  - وقت التحضير: 15 دقيقة
  - وقت التوصيل: 7 دقائق
  - وقت إضافي: 5 دقائق

## 3. حساب تكلفة التوصيل بناءً على المسافة

```javascript
import { calculateDistance } from '../utils/deliveryTimeCalculator';

function calculateDeliveryFee(vendor, customerLat, customerLng) {
  const distance = calculateDistance(
    vendor.latitude,
    vendor.longitude,
    customerLat,
    customerLng
  );

  // إذا كان نوع التوصيل "حسب المسافة"
  if (vendor.delivery_type === 'distance') {
    const fee = distance * vendor.price_per_km;
    return Math.max(fee, vendor.min_delivery_fee || 0);
  }

  // إذا كان نوع التوصيل "ثابت"
  if (vendor.delivery_type === 'fixed') {
    return vendor.delivery_fee_per_km;
  }

  return 0;
}

// الاستخدام:
const deliveryFee = calculateDeliveryFee(vendor, 31.5234, 34.4512);
console.log(`تكلفة التوصيل: ${deliveryFee} شيكل`);
```

## 4. فلترة المتاجر حسب القرب من العميل

```javascript
import { getVendorsWithDeliveryEstimates } from '../lib/deliveryEstimateApi';

async function getNearbyVendors(customerLat, customerLng) {
  const result = await getVendorsWithDeliveryEstimates(
    customerLat,
    customerLng,
    {
      maxDistance: 10,      // 10 كم كحد أقصى
      sortBy: 'distance',   // ترتيب من الأقرب للأبعد
      categoryId: 'food'    // فقط المطاعم (اختياري)
    }
  );

  if (result.success) {
    return result.vendors.map(vendor => ({
      id: vendor.id,
      name: vendor.store_name,
      distance: vendor.estimate.distanceKm,
      deliveryTime: vendor.estimate.estimatedDeliveryTime,
      canDeliver: vendor.canDeliver
    }));
  }

  return [];
}

// الاستخدام:
const nearbyVendors = await getNearbyVendors(31.5017, 34.4668);
nearbyVendors.forEach(vendor => {
  console.log(`${vendor.name} - ${vendor.distance} كم - ${vendor.deliveryTime}`);
});
```

## 5. في تطبيق الموبايل (API)

### إنشاء Edge Function لحساب وقت التوصيل:

```typescript
// supabase/functions/calculate-delivery-time/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { vendorId, customerLat, customerLng } = await req.json();

    // جلب معلومات المتجر من قاعدة البيانات
    // ... (كود الاستعلام)

    const distance = calculateDistance(
      vendor.latitude,
      vendor.longitude,
      customerLat,
      customerLng
    );

    const travelTime = (distance / 30) * 60; // 30 كم/ساعة
    const totalTime = vendor.estimated_delivery_time + travelTime + 5;

    return new Response(
      JSON.stringify({
        success: true,
        distance,
        estimatedTime: Math.ceil(totalTime)
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
```

## 6. في صفحة عرض المتاجر للعميل

```jsx
import { useState, useEffect } from 'react';
import { getVendorsWithDeliveryEstimates } from '../lib/deliveryEstimateApi';
import { Clock, MapPin } from 'lucide-react';

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [customerLocation, setCustomerLocation] = useState(null);

  useEffect(() => {
    // الحصول على موقع العميل
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }
    );
  }, []);

  useEffect(() => {
    if (customerLocation) {
      loadVendors();
    }
  }, [customerLocation]);

  const loadVendors = async () => {
    const result = await getVendorsWithDeliveryEstimates(
      customerLocation.lat,
      customerLocation.lng,
      { sortBy: 'distance' }
    );

    if (result.success) {
      setVendors(result.vendors);
    }
  };

  return (
    <div className="vendors-grid">
      {vendors.map(vendor => (
        <div key={vendor.id} className="vendor-card">
          <img src={vendor.logo_url} alt={vendor.store_name} />
          <h3>{vendor.store_name}</h3>

          <div className="delivery-info">
            <div className="info-item">
              <Clock className="w-4 h-4" />
              <span>{vendor.estimate.estimatedDeliveryTime}</span>
            </div>

            <div className="info-item">
              <MapPin className="w-4 h-4" />
              <span>{vendor.estimate.distanceKm} كم</span>
            </div>
          </div>

          {!vendor.canDeliver && (
            <div className="warning">
              خارج نطاق التوصيل
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## 7. تحديث موقع المتجر

```javascript
import { updateVendorLocation } from '../lib/deliveryEstimateApi';

async function updateMyLocation(vendorId) {
  // الحصول على الموقع الحالي
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const result = await updateVendorLocation(
        vendorId,
        position.coords.latitude,
        position.coords.longitude
      );

      if (result.success) {
        alert('تم تحديث موقع المتجر بنجاح');
      } else {
        alert('فشل في تحديث الموقع: ' + result.error);
      }
    },
    (error) => {
      alert('فشل في الحصول على الموقع الحالي');
    }
  );
}
```

## 8. إشعار السائق بوقت التوصيل المتوقع

```javascript
import { calculateDeliveryEstimate } from '../lib/deliveryEstimateApi';

async function notifyDriverWithEstimate(order) {
  const estimate = await calculateDeliveryEstimate(
    order.vendor_id,
    order.address_latitude,
    order.address_longitude
  );

  if (estimate.success) {
    const message = `
      طلب جديد #${order.order_number}
      المسافة: ${estimate.estimate.distanceKm} كم
      الوقت المتوقع: ${estimate.estimate.estimatedDeliveryTime}
      يجب الوصول قبل: ${calculateArrivalTime(estimate.estimate.totalTimeMinutes)}
    `;

    // إرسال إشعار للسائق
    sendNotification(order.driver_id, message);
  }
}

function calculateArrivalTime(minutes) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now.toLocaleTimeString('ar-PS', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

## النتائج المتوقعة

بعد تطبيق هذه الأمثلة:

✅ **للمتاجر:**
- تحديد موقع دقيق على الخريطة
- حفظ تلقائي للإحداثيات
- إمكانية تحديث الموقع في أي وقت

✅ **للعملاء:**
- رؤية وقت التوصيل المتوقع لكل متجر
- فلترة المتاجر حسب القرب
- معرفة تكلفة التوصيل بناءً على المسافة

✅ **للسائقين:**
- معرفة المسافة والوقت المتوقع
- تخطيط أفضل للمسارات
- تقديرات دقيقة لوقت الوصول

✅ **للإدارة:**
- تتبع المسافات والأوقات
- تحسين توزيع السائقين
- تحليل كفاءة التوصيل
