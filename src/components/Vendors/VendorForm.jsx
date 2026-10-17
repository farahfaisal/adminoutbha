import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import MediaUpload from '../Products/MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';
import MapSelector from './MapSelector';
import ServiceAreaSelector from './ServiceAreaSelector';
import CategorySelector from './CategorySelector';
import ZoneDeliverySelector from './ZoneDeliverySelector';
import VendorServiceAreasSelector from './VendorServiceAreasSelector';

export default function VendorForm({ onSubmit, initialData = null, loading = false }) {
  const [formData, setFormData] = useState({
    // بيانات المتجر
    store_name: '',
    phone: '',
    email: '', // Make sure email field is included
    password: '',
    address: '',
    description: '',
    delivery_type: 'distance',
    delivery_radius: 5,
    price_per_km: 2,
    min_delivery_fee: 5,
    delivery_fee_per_km: 1,
    estimated_delivery_time: 30,
    status: 'active',
    logo_url: '',
    banner_url: '',
    commission_rate: 10,
    wallet_enabled: false,
    auto_charge: false,
    service_areas: [],
    categories: [],
    // بيانات الموقع
    latitude: null,
    longitude: null,
    // بيانات العضوية
    membership: {
      type: 'basic',
      expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // سنة من اليوم
      commission_rate: 10
    },
    // بيانات المتجر المميز
    featured: false,
    featured_until: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], // شهر من اليوم
    featured_order: 1,
    // بيانات مناطق التوصيل
    delivery_zones: [],
    // مناطق الخدمة الجديدة
    vendor_service_areas: []
  });

  const [categories, setCategories] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [mapKey, setMapKey] = useState(Date.now()); // لإعادة تحميل الخريطة عند تغيير الموقع
  const [deliveryAreas, setDeliveryAreas] = useState([]);

  // قائمة المناطق المتاحة
  const areas = [
    // مدن الضفة الغربية الرئيسية
    'رام الله',
    'البيرة',
    'نابلس',
    'جنين',
    'طولكرم',
    'قلقيلية',
    'طوباس',
    'سلفيت',
    'أريحا',
    'بيت لحم',
    'الخليل',
    // مناطق ومدن إضافية
    'بيت جالا',
    'بيت ساحور',
    'بيرزيت',
    'الظاهرية',
    'دورا',
    'يطا',
    'عنبتا',
    'بيت فجار',
    'بديا',
    'عزون',
    'بيت أمر',
    'حلحول',
    'سعير',
    'ترقوميا',
    'عرابة',
    'يعبد',
    'قباطية',
    'طمون',
    'عقابا',
    'بيت فوريك',
    'عصيرة الشمالية',
    'بيتا',
    'حوارة',
    'سبسطية',
    'عقربا'
  ];

  // جلب التصنيفات ومناطق التوصيل من قاعدة البيانات
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLocalLoading(true);
        
        // جلب التصنيفات
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);
        
        // جلب مناطق التوصيل من جدول shipping_zones
        const { data: shippingZonesData, error: shippingZonesError } = await supabase
          .from('shipping_zones')
          .select('name')
          .order('name');
        
        if (shippingZonesError) {
          console.error('Error fetching shipping zones:', shippingZonesError);
        } else {
          // استخراج أسماء المناطق من البيانات
          const zoneNames = shippingZonesData.map(zone => zone.name);
          setDeliveryAreas(zoneNames);
        }
        
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('فشل في تحميل التصنيفات');
      } finally {
        setLocalLoading(false);
      }
    };

    fetchData();
  }, []);

  // تحميل البيانات الأولية إذا كانت موجودة
  useEffect(() => {
    if (initialData) {
      const loadVendorData = async () => {
        try {
          let categoryIds = [];

          // التحقق من وجود التصنيفات في initialData أولاً
          if (initialData.categories && Array.isArray(initialData.categories) && initialData.categories.length > 0) {
            // استخدام التصنيفات الموجودة في initialData
            categoryIds = initialData.categories;
          } else {
            // جلب التصنيفات المرتبطة بالبائع من قاعدة البيانات
            const { data: vendorCategoriesData, error: categoriesError } = await supabase
              .from('vendor_categories')
              .select('category_id')
              .eq('vendor_id', initialData.id);

            if (categoriesError) {
              console.error('Error fetching vendor categories:', categoriesError);
            }

            // استخراج معرفات التصنيفات
            categoryIds = vendorCategoriesData ? vendorCategoriesData.map(item => item.category_id) : [];
          }

          // تحويل البيانات إلى الشكل المناسب للنموذج
          const formattedData = {
            ...initialData,
            // التأكد من أن البيانات الرقمية هي أرقام وليست نصوص
            delivery_radius: initialData.delivery_radius ? parseFloat(initialData.delivery_radius) : 5,
            price_per_km: initialData.price_per_km ? parseFloat(initialData.price_per_km) : 2,
            min_delivery_fee: initialData.min_delivery_fee ? parseFloat(initialData.min_delivery_fee) : 5,
            delivery_fee_per_km: initialData.delivery_fee_per_km ? parseFloat(initialData.delivery_fee_per_km) : 1,
            estimated_delivery_time: initialData.estimated_delivery_time ? parseInt(initialData.estimated_delivery_time) : 30,
            commission_rate: initialData.commission_rate ? parseFloat(initialData.commission_rate) : 10,
            // التأكد من أن البيانات المنطقية هي قيم منطقية
            wallet_enabled: !!initialData.wallet_enabled,
            auto_charge: !!initialData.auto_charge,
            featured: !!initialData.featured,
            // التأكد من أن المصفوفات هي مصفوفات
            service_areas: Array.isArray(initialData.service_areas) ? initialData.service_areas : [],
            // تعيين التصنيفات المحددة
            categories: categoryIds,
            // التأكد من أن مناطق التوصيل هي مصفوفة
            delivery_zones: Array.isArray(initialData.delivery_zones) ? initialData.delivery_zones : [],
            // تحويل zones مع vendor_service_areas إلى service_areas لعرضها في النموذج
            delivery_type: initialData.delivery_type === 'zones' && initialData.vendor_service_areas && initialData.vendor_service_areas.length > 0
              ? 'service_areas'
              : initialData.delivery_type,
            vendor_service_areas: Array.isArray(initialData.vendor_service_areas) ? initialData.vendor_service_areas : [],
            // Make sure email is included
            email: initialData.email || ''
          };

          setFormData(formattedData);
        } catch (error) {
          console.error('Error loading vendor data:', error);
        }
      };

      loadVendorData();
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // التحقق من البيانات المطلوبة
      if (!formData.store_name || !formData.phone || !formData.address) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        return;
      }

      // التحقق من رفع صورة اللوغو (إلزامي عند الإضافة فقط)
      if (!initialData && !formData.logo_url) {
        toast.error('الرجاء رفع صورة اللوغو قبل إضافة البائع');
        return;
      }

      // التحقق من الحقول الإجبارية حسب نوع التوصيل
      if (formData.delivery_type === 'distance') {
        if (!formData.delivery_radius || !formData.price_per_km) {
          toast.error('الرجاء تعبئة نطاق التوصيل وسعر الكيلومتر');
          return;
        }
      } else if (formData.delivery_type === 'zones') {
        if (!formData.delivery_zones || formData.delivery_zones.length === 0) {
          toast.error('الرجاء إضافة منطقة توصيل واحدة على الأقل');
          return;
        }
      } else if (formData.delivery_type === 'service_areas') {
        if (!formData.vendor_service_areas || formData.vendor_service_areas.length === 0) {
          toast.error('الرجاء تحديد منطقة خدمة واحدة على الأقل');
          return;
        }
      }

      // التحقق من تاريخ انتهاء العضوية
      if (!formData.membership.expires_at) {
        toast.error('الرجاء تحديد تاريخ انتهاء العضوية');
        return;
      }

      // التحقق من اختيار تصنيف واحد على الأقل
      if (formData.categories.length === 0) {
        toast.error('الرجاء اختيار تصنيف واحد على الأقل');
        return;
      }

      // إعداد بيانات المتجر المميز
      const vendorData = { ...formData };
      if (formData.featured) {
        vendorData.featured_until = formData.featured_until;
        vendorData.featured_order = formData.featured_order;
      } else {
        vendorData.featured_until = null;
        vendorData.featured_order = null;
      }

      // تحويل service_areas إلى zones لأن قاعدة البيانات لا تدعم service_areas
      if (vendorData.delivery_type === 'service_areas') {
        vendorData.delivery_type = 'zones';
      }

      // تنفيذ الإرسال
      onSubmit(e, vendorData);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleLocationSelect = (lat, lng) => {
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lng
    });
    setMapKey(Date.now()); // إعادة تحميل الخريطة
  };

  const handleServiceAreasChange = (areas) => {
    setFormData({
      ...formData,
      service_areas: areas
    });
  };

  const handleCategoriesChange = (selectedCategories) => {
    setFormData({
      ...formData,
      categories: selectedCategories
    });
  };

  const handleDeliveryZonesChange = (zones) => {
    setFormData({
      ...formData,
      delivery_zones: zones
    });
  };

  const handleLogoUpload = ({ preview }) => {
    if (preview) {
      setFormData({ ...formData, logo_url: preview });
    }
  };

  const handleBannerUpload = ({ preview }) => {
    if (preview) {
      setFormData({ ...formData, banner_url: preview });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">بيانات المتجر</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المتجر <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم الهاتف <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder={initialData ? "اتركه فارغاً للاحتفاظ بكلمة المرور الحالية" : "كلمة مرور جديدة"}
            />
            {initialData && (
              <p className="mt-1 text-xs text-gray-500">
                اتركه فارغاً للاحتفاظ بكلمة المرور الحالية
              </p>
            )}
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العنوان <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              وصف المتجر
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              صورة اللوجو {!initialData && <span className="text-red-600">*</span>}
            </label>
            <MediaUpload
              type="image"
              preview={formData.logo_url}
              onUpload={handleLogoUpload}
              storeInSupabase={true}
              bucket={BUCKETS.VENDORS}
              folder="logos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              صورة الغلاف
            </label>
            <MediaUpload
              type="image"
              preview={formData.banner_url}
              onUpload={handleBannerUpload}
              storeInSupabase={true}
              bucket={BUCKETS.VENDORS}
              folder="banners"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">تصنيف المتجر</h3>
        <div className="mb-4">
          <CategorySelector 
            availableCategories={categories}
            selectedCategories={formData.categories}
            onChange={handleCategoriesChange}
            loading={localLoading}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">حالة المتجر</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحالة <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="pending">معلق</option>
              <option value="suspended">موقوف</option>
              <option value="busy">مشغول</option>
            </select>
          </div>
          
          <div>
            <label className="flex items-center space-x-2 mt-8">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>متجر مميز</span>
            </label>
          </div>

          {formData.featured && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ انتهاء التمييز
                </label>
                <input
                  type="date"
                  value={formData.featured_until}
                  onChange={(e) => setFormData({ ...formData, featured_until: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required={formData.featured}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ترتيب العرض (الأقل = الأعلى)
                </label>
                <input
                  type="number"
                  value={formData.featured_order}
                  onChange={(e) => setFormData({ ...formData, featured_order: parseInt(e.target.value) })}
                  className="w-full border rounded-md px-3 py-2"
                  min="1"
                  required={formData.featured}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          موقع المتجر
          {formData.latitude && formData.longitude && (
            <span className="text-sm font-normal text-green-600 mr-2">✓ تم تحديد الموقع</span>
          )}
        </h3>

        {!formData.latitude || !formData.longitude ? (
          <div className="mb-4 p-4 bg-yellow-50 border-r-4 border-yellow-400 rounded">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  يجب تحديد موقع المتجر
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  موقع المتجر مطلوب لحساب وقت التوصيل المتوقع وتكلفة التوصيل للعملاء
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-green-50 border-r-4 border-green-400 rounded">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  تم تحديد الموقع بنجاح
                </p>
                <p className="text-sm text-green-700 mt-1">
                  سيتم استخدام هذا الموقع لحساب وقت التوصيل والمسافة للعملاء
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            حدد موقع المتجر على الخريطة بالنقر على المكان المناسب أو اسحب العلامة
          </p>
          <MapSelector
            key={mapKey}
            initialLat={formData.latitude}
            initialLng={formData.longitude}
            onLocationSelect={handleLocationSelect}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              خط العرض (Latitude)
            </label>
            <input
              type="text"
              value={formData.latitude || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, latitude: value ? parseFloat(value) : null });
              }}
              className="w-full border rounded-md px-3 py-2 bg-gray-50"
              placeholder="مثال: 31.5017"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              خط الطول (Longitude)
            </label>
            <input
              type="text"
              value={formData.longitude || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, longitude: value ? parseFloat(value) : null });
              }}
              className="w-full border rounded-md px-3 py-2 bg-gray-50"
              placeholder="مثال: 34.4668"
              readOnly
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>ملاحظة:</strong> يتم تحديث الإحداثيات تلقائياً عند تحديد الموقع على الخريطة
          </p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">إعدادات التوصيل</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            نوع التوصيل <span className="text-red-600">*</span>
          </label>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-300 relative">
              <input
                type="radio"
                name="delivery_type"
                value="distance"
                checked={formData.delivery_type === 'distance'}
                onChange={() => setFormData({ ...formData, delivery_type: 'distance' })}
                className="mr-2 text-blue-600"
              />
              <div className="mr-2">
                <span className="font-medium">حسب المسافة</span>
                <p className="text-sm text-gray-500 mt-1">يتم احتساب تكلفة التوصيل بناءً على المسافة بالكيلومتر</p>
              </div>
            </label>
            
            <label className="flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-300 relative">
              <input
                type="radio"
                name="delivery_type"
                value="fixed"
                checked={formData.delivery_type === 'fixed'}
                onChange={() => setFormData({ ...formData, delivery_type: 'fixed' })}
                className="mr-2 text-blue-600"
              />
              <div className="mr-2">
                <span className="font-medium">سعر ثابت</span>
                <p className="text-sm text-gray-500 mt-1">سعر توصيل ثابت لجميع الطلبات بغض النظر عن المسافة</p>
              </div>
            </label>
            
            <label className="flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-300 relative">
              <input
                type="radio"
                name="delivery_type"
                value="zones"
                checked={formData.delivery_type === 'zones'}
                onChange={() => setFormData({ ...formData, delivery_type: 'zones' })}
                className="mr-2 text-blue-600"
              />
              <div className="mr-2">
                <span className="font-medium">مناطق</span>
                <p className="text-sm text-gray-500 mt-1">تحديد أسعار مختلفة للتوصيل حسب المنطقة</p>
              </div>
            </label>

            <label className="flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-300 relative">
              <input
                type="radio"
                name="delivery_type"
                value="service_areas"
                checked={formData.delivery_type === 'service_areas'}
                onChange={() => setFormData({ ...formData, delivery_type: 'service_areas' })}
                className="mr-2 text-blue-600"
              />
              <div className="mr-2">
                <span className="font-medium">مناطق الخدمة</span>
                <p className="text-sm text-gray-500 mt-1">استخدام مناطق الخدمة المحددة في صفحة مناطق الخدمة</p>
              </div>
            </label>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {formData.delivery_type === 'distance' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نطاق التوصيل (كم) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={formData.delivery_radius}
                  onChange={(e) => setFormData({ ...formData, delivery_radius: Number(e.target.value) })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر الكيلومتر (₪) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={formData.price_per_km}
                  onChange={(e) => setFormData({ ...formData, price_per_km: Number(e.target.value) })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأدنى لتكلفة التوصيل (₪)
                </label>
                <input
                  type="number"
                  value={formData.min_delivery_fee}
                  onChange={(e) => setFormData({ ...formData, min_delivery_fee: Number(e.target.value) })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تكلفة التوصيل لكل كيلومتر (₪)
                </label>
                <input
                  type="number"
                  value={formData.delivery_fee_per_km}
                  onChange={(e) => setFormData({ ...formData, delivery_fee_per_km: Number(e.target.value) })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.1"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              وقت التوصيل المقدر (دقيقة) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={formData.estimated_delivery_time}
              onChange={(e) => setFormData({ ...formData, estimated_delivery_time: Number(e.target.value) })}
              className="w-full border rounded-md px-3 py-2"
              min="5"
              step="5"
              required
              placeholder="مثال: 30 دقيقة"
            />
            <p className="mt-1 text-sm text-gray-500">
              الوقت المتوقع لتوصيل الطلبات (مثلاً: 30-45 دقيقة)
            </p>
          </div>

          {formData.delivery_type === 'fixed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سعر التوصيل الثابت (₪) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.min_delivery_fee}
                onChange={(e) => setFormData({ ...formData, min_delivery_fee: Number(e.target.value) })}
                className="w-full border rounded-md px-3 py-2"
                min="0"
                step="0.1"
                required
              />
            </div>
          )}
          
          {formData.delivery_type === 'zones' && (
            <div className="col-span-full">
              <ZoneDeliverySelector
                zones={formData.delivery_zones}
                onChange={handleDeliveryZonesChange}
                availableAreas={areas}
              />
            </div>
          )}

          {formData.delivery_type === 'service_areas' && (
            <div className="col-span-full">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-2">كيفية استخدام مناطق الخدمة:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>حدد مناطق الخدمة التي يغطيها البائع في القسم أدناه</li>
                      <li>قم بتعيين سعر توصيل مخصص لكل منطقة فرعية</li>
                      <li>سيظهر للعملاء المناطق المتاحة مع أسعارها عند الطلب</li>
                      <li>يتم احتساب سعر التوصيل تلقائياً حسب المنطقة المختارة</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-800">
                    يمكنك تحديد مناطق الخدمة وأسعارها في القسم التالي
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">مناطق الخدمة وأسعار التوصيل</h3>
        <VendorServiceAreasSelector
          vendorId={initialData?.id}
          selectedAreas={formData.vendor_service_areas || []}
          onUpdate={(areas) => setFormData({ ...formData, vendor_service_areas: areas })}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">إعدادات العضوية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نوع العضوية <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.membership.type}
              onChange={(e) => setFormData({
                ...formData,
                membership: { ...formData.membership, type: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="basic">أساسية</option>
              <option value="premium">مميزة</option>
              <option value="gold">ذهبية</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة العمولة (%) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={formData.membership.commission_rate}
              onChange={(e) => setFormData({
                ...formData,
                membership: { ...formData.membership, commission_rate: Number(e.target.value) }
              })}
              className="w-full border rounded-md px-3 py-2"
              min="0"
              max="100"
              step="0.1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              تاريخ انتهاء العضوية <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={formData.membership.expires_at}
              onChange={(e) => setFormData({
                ...formData,
                membership: { ...formData.membership, expires_at: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">إعدادات إضافية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة العمولة (%) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={formData.commission_rate}
              onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
              className="w-full border rounded-md px-3 py-2"
              min="0"
              max="100"
              step="0.1"
              required
            />
          </div>
          
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.wallet_enabled}
                onChange={(e) => setFormData({ ...formData, wallet_enabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>تفعيل المحفظة</span>
            </label>
          </div>
          
          {formData.wallet_enabled && (
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.auto_charge}
                  onChange={(e) => setFormData({ ...formData, auto_charge: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>تفعيل الشحن التلقائي</span>
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <button
          type="submit"
          className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={loading}
        >
          {loading ? 'جاري الحفظ...' : (initialData ? 'تحديث' : 'إضافة')}
        </button>
      </div>
    </form>
  );
}