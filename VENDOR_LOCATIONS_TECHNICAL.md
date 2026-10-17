# 🔧 التوثيق التقني - نظام إدارة مواقع المتاجر

## البنية التقنية

### الملفات المُضافة

```
src/
  components/
    Pages/
      VendorLocations.jsx          ← المكون الرئيسي

  Sidebar/
    Sidebar.jsx                    ← تم التحديث (إضافة عنصر القائمة)

  AdminDashboard.jsx               ← تم التحديث (إضافة Route)
```

---

## المكون الرئيسي: VendorLocations.jsx

### المكتبات المستخدمة

```javascript
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { toast } from 'react-toastify';
import { getVendors, updateVendor } from '../../lib/vendorsApi';
import L from 'leaflet';
```

### الحالات (States)

| State | النوع | الوصف |
|-------|-------|--------|
| `vendors` | Array | قائمة جميع المتاجر |
| `selectedVendor` | Object | المتجر المحدد حالياً |
| `loading` | Boolean | حالة التحميل |
| `saving` | Boolean | حالة الحفظ |
| `searchQuery` | String | نص البحث |
| `filterNoLocation` | Boolean | فلتر المتاجر بدون موقع |
| `mapCenter` | [Number, Number] | مركز الخريطة [lat, lng] |
| `mapZoom` | Number | مستوى التكبير |
| `tempLocation` | [Number, Number] | الموقع المؤقت قبل الحفظ |

---

## الدوال الرئيسية

### 1. fetchVendors()
```javascript
const fetchVendors = async () => {
  try {
    setLoading(true);
    const data = await getVendors();
    setVendors(data);
  } catch (error) {
    toast.error('فشل في تحميل المتاجر');
  } finally {
    setLoading(false);
  }
};
```
**الوظيفة**: جلب قائمة المتاجر من قاعدة البيانات

---

### 2. handleVendorSelect(vendor)
```javascript
const handleVendorSelect = (vendor) => {
  setSelectedVendor(vendor);

  if (vendor.latitude && vendor.longitude) {
    const position = [vendor.latitude, vendor.longitude];
    setMapCenter(position);
    setMapZoom(15);
    setTempLocation(position);
  } else {
    setTempLocation(null);
  }
};
```
**الوظيفة**: عند اختيار متجر من القائمة
- تعيين المتجر المحدد
- نقل الخريطة إلى موقع المتجر (إن وجد)
- تعيين الموقع المؤقت

---

### 3. handleMapClick(e)
```javascript
const handleMapClick = (e) => {
  if (!selectedVendor) {
    toast.warning('يرجى اختيار متجر أولاً');
    return;
  }

  const { lat, lng } = e.latlng;
  setTempLocation([lat, lng]);
};
```
**الوظيفة**: عند النقر على الخريطة
- التحقق من اختيار متجر
- تحديد الموقع المؤقت الجديد

---

### 4. handleMarkerDrag(lat, lng)
```javascript
const handleMarkerDrag = (lat, lng) => {
  setTempLocation([lat, lng]);
};
```
**الوظيفة**: عند سحب العلامة على الخريطة
- تحديث الموقع المؤقت

---

### 5. handleSaveLocation()
```javascript
const handleSaveLocation = async () => {
  if (!selectedVendor || !tempLocation) {
    toast.warning('يرجى تحديد موقع على الخريطة');
    return;
  }

  try {
    setSaving(true);

    await updateVendor(selectedVendor.id, {
      ...selectedVendor,
      latitude: tempLocation[0],
      longitude: tempLocation[1]
    });

    // تحديث القائمة المحلية
    setVendors(vendors.map(v =>
      v.id === selectedVendor.id
        ? { ...v, latitude: tempLocation[0], longitude: tempLocation[1] }
        : v
    ));

    // تحديث المتجر المحدد
    setSelectedVendor({
      ...selectedVendor,
      latitude: tempLocation[0],
      longitude: tempLocation[1]
    });

    toast.success('تم حفظ موقع المتجر بنجاح');
  } catch (error) {
    toast.error('فشل في حفظ موقع المتجر');
  } finally {
    setSaving(false);
  }
};
```
**الوظيفة**: حفظ الموقع في قاعدة البيانات
- التحقق من وجود موقع
- استدعاء API لتحديث البيانات
- تحديث الحالة المحلية
- عرض رسالة نجاح/فشل

---

### 6. handleUseCurrentLocation()
```javascript
const handleUseCurrentLocation = () => {
  if (!selectedVendor) {
    toast.warning('يرجى اختيار متجر أولاً');
    return;
  }

  if (!navigator.geolocation) {
    toast.error('المتصفح الخاص بك لا يدعم تحديد الموقع');
    return;
  }

  toast.info('جارٍ الحصول على موقعك الحالي...');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const newLocation = [latitude, longitude];
      setTempLocation(newLocation);
      setMapCenter(newLocation);
      setMapZoom(15);
      toast.success('تم تحديد موقعك الحالي');
    },
    (error) => {
      // معالجة الأخطاء
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};
```
**الوظيفة**: استخدام GPS للحصول على الموقع الحالي
- التحقق من دعم المتصفح
- طلب الإذن من المستخدم
- الحصول على الإحداثيات
- تحديث الخريطة

---

## المكونات الفرعية

### MapController
```javascript
function MapController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);

  return null;
}
```
**الوظيفة**: التحكم في عرض الخريطة وتحريكها

---

### DraggableMarker
```javascript
function DraggableMarker({ position, onPositionChange, icon }) {
  const [markerPosition, setMarkerPosition] = useState(position);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  return (
    <Marker
      position={markerPosition}
      icon={icon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setMarkerPosition([pos.lat, pos.lng]);
          onPositionChange(pos.lat, pos.lng);
        },
      }}
    />
  );
}
```
**الوظيفة**: علامة قابلة للسحب على الخريطة

---

## الأيقونات المخصصة

### redIcon - علامة حمراء
```javascript
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/.../marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/.../marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
```

### greenIcon - علامة خضراء
للمتاجر المحددة على الخريطة

### blueIcon - علامة زرقاء
للموقع المؤقت الذي يتم تحديده

---

## الفلترة والبحث

### البحث
```javascript
const filteredVendors = vendors.filter(vendor => {
  const matchesSearch =
    vendor.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.address?.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesFilter =
    !filterNoLocation || (!vendor.latitude || !vendor.longitude);

  return matchesSearch && matchesFilter;
});
```

### الإحصائيات
```javascript
const vendorsWithoutLocation =
  vendors.filter(v => !v.latitude || !v.longitude).length;

const vendorsWithLocation =
  vendors.filter(v => v.latitude && v.longitude).length;
```

---

## قاعدة البيانات

### جدول vendors
الحقول المستخدمة:
- `id` (UUID) - المعرف الفريد
- `store_name` (TEXT) - اسم المتجر
- `address` (TEXT) - العنوان
- `logo_url` (TEXT) - رابط الشعار
- `latitude` (NUMERIC) - خط العرض
- `longitude` (NUMERIC) - خط الطول

### API المستخدمة

#### getVendors()
```javascript
// من: src/lib/vendorsApi.js
export const getVendors = async () => {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
```

#### updateVendor(id, vendorData)
```javascript
// من: src/lib/vendorsApi.js
export const updateVendor = async (id, vendorData) => {
  const { data, error } = await supabase
    .from('vendors')
    .update({
      store_name: vendorData.store_name,
      latitude: vendorData.latitude,
      longitude: vendorData.longitude,
      // ...باقي الحقول
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
};
```

---

## التكامل مع النظام

### إضافة إلى AdminDashboard.jsx
```javascript
import VendorLocations from './Pages/VendorLocations';

// في Routes
<Route path="/vendor-locations" element={<VendorLocations />} />
```

### إضافة إلى Sidebar.jsx
```javascript
{
  id: 'vendors-management',
  label: 'إدارة البائعين',
  icon: BuildingStorefrontIcon,
  subItems: [
    // ...باقي العناصر
    { id: 'vendor-locations', label: 'مواقع المتاجر' }
  ]
}
```

---

## التصميم المستجيب

### Tailwind CSS Classes المستخدمة

#### التخطيط الرئيسي
```css
h-[calc(100vh-4rem)]  /* ارتفاع كامل الشاشة مطروحاً منه TopBar */
flex flex-col         /* تخطيط عمودي */
```

#### القائمة الجانبية
```css
w-1/3               /* عرض 33% */
overflow-y-auto     /* تمرير عمودي */
```

#### الخريطة
```css
flex-1              /* تأخذ باقي المساحة */
relative            /* للموضع المطلق للعناصر الداخلية */
```

---

## الأداء والتحسينات

### 1. Lazy Loading
الصفحة تُحمل فقط عند الدخول إليها

### 2. Memoization
يمكن تحسين الأداء بإضافة:
```javascript
import { useMemo } from 'react';

const filteredVendors = useMemo(() => {
  return vendors.filter(/* ... */);
}, [vendors, searchQuery, filterNoLocation]);
```

### 3. Debouncing للبحث
يمكن إضافة debouncing للبحث:
```javascript
import { debounce } from 'lodash';

const debouncedSearch = debounce((query) => {
  setSearchQuery(query);
}, 300);
```

---

## الأمان

### 1. Row Level Security (RLS)
جدول `vendors` يجب أن يكون محمياً بسياسات RLS

### 2. التحقق من الصلاحيات
الصفحة محمية بـ ProtectedRoute:
```javascript
<Route path="/admin-dashboard/*" element={
  <ProtectedRoute allowedRoles={['admin', 'service_area_manager']}>
    <AdminDashboard />
  </ProtectedRoute>
} />
```

---

## الاختبار

### Unit Tests مقترحة
```javascript
describe('VendorLocations', () => {
  it('should load vendors on mount', async () => {
    // Test implementation
  });

  it('should filter vendors by search query', () => {
    // Test implementation
  });

  it('should save vendor location', async () => {
    // Test implementation
  });

  it('should use current location', async () => {
    // Test implementation
  });
});
```

---

## التوسعات المستقبلية

### 1. رسم نطاق التوصيل
```javascript
import { Circle } from 'react-leaflet';

<Circle
  center={[vendor.latitude, vendor.longitude]}
  radius={vendor.delivery_radius * 1000} // km to meters
  pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
/>
```

### 2. Batch Update
تحديث مواقع عدة متاجر دفعة واحدة

### 3. Import/Export
استيراد/تصدير المواقع من/إلى CSV

### 4. التحقق الآلي
التحقق من صحة الموقع باستخدام Geocoding API

---

## المصادر المستخدمة

| المصدر | الاستخدام |
|--------|-----------|
| OpenStreetMap | خرائط الأساس |
| Leaflet CDN | الأيقونات |
| react-leaflet | مكتبة الخرائط |
| Supabase | قاعدة البيانات |
| Tailwind CSS | التصميم |
| react-toastify | الإشعارات |

---

## الخلاصة التقنية

- **المكتبة الرئيسية**: react-leaflet v4.2.1
- **خدمة الخرائط**: OpenStreetMap (مجانية)
- **قاعدة البيانات**: Supabase PostgreSQL
- **الحقول المستخدمة**: latitude, longitude (NUMERIC)
- **API Calls**: 2 (getVendors, updateVendor)
- **States**: 9 states رئيسية
- **Components**: 3 مكونات (رئيسي + 2 فرعي)
- **Icons**: 3 أيقونات ملونة مخصصة

---

**الإصدار**: 1.0.0
**التاريخ**: 2026-02-02
**التوافق**: React 18.2.0+
