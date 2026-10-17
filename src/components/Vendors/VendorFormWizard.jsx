import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import MediaUpload from '../Products/MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';
import MapSelector from './MapSelector';
import CategorySelector from './CategorySelector';
import VendorServiceAreasSelector from './VendorServiceAreasSelector';
import ZoneDeliverySelector from './ZoneDeliverySelector';
import WorkingHoursManager from './WorkingHoursManager';

const STEPS = [
  { id: 1, title: 'المعلومات الأساسية', icon: '📋' },
  { id: 2, title: 'الموقع والتصنيفات', icon: '📍' },
  { id: 3, title: 'التوصيل والأسعار', icon: '🚚' },
  { id: 4, title: 'أوقات الدوام والعطل', icon: '🕐' },
  { id: 5, title: 'الصور والعضوية', icon: '🖼️' }
];

export default function VendorFormWizard({ onSubmit, initialData = null, loading = false }) {
  const isEditMode = !!initialData;
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    store_name: '',
    phone: '',
    email: '',
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
    main_service_area_id: null,
    service_areas: [],
    categories: [],
    latitude: null,
    longitude: null,
    membership: {
      type: 'basic',
      expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      commission_rate: 10
    },
    featured: false,
    featured_until: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    featured_order: 1,
    delivery_zones: [],
    vendor_service_areas: [],
    working_hours: {
      saturday: { enabled: true, open: '08:00', close: '22:00' },
      sunday: { enabled: true, open: '08:00', close: '22:00' },
      monday: { enabled: true, open: '08:00', close: '22:00' },
      tuesday: { enabled: true, open: '08:00', close: '22:00' },
      wednesday: { enabled: true, open: '08:00', close: '22:00' },
      thursday: { enabled: true, open: '08:00', close: '22:00' },
      friday: { enabled: false, open: null, close: null }
    },
    holidays: [],
    auto_status_change: true,
    timezone: 'Asia/Gaza'
  });

  const [categories, setCategories] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);

  useEffect(() => {
    fetchCategories();
    fetchDeliveryAreas();
    fetchServiceAreas();

    if (initialData) {
      // تحميل جميع بيانات البائع عند التعديل
      const defaultFormData = {
        store_name: '',
        phone: '',
        email: '',
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
        main_service_area_id: null,
        service_areas: [],
        categories: [],
        latitude: null,
        longitude: null,
        membership: {
          type: 'basic',
          expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          commission_rate: 10
        },
        featured: false,
        featured_until: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        featured_order: 1,
        delivery_zones: [],
        vendor_service_areas: [],
        working_hours: {
          saturday: { enabled: true, open: '08:00', close: '22:00' },
          sunday: { enabled: true, open: '08:00', close: '22:00' },
          monday: { enabled: true, open: '08:00', close: '22:00' },
          tuesday: { enabled: true, open: '08:00', close: '22:00' },
          wednesday: { enabled: true, open: '08:00', close: '22:00' },
          thursday: { enabled: true, open: '08:00', close: '22:00' },
          friday: { enabled: false, open: null, close: null }
        },
        holidays: [],
        auto_status_change: true,
        timezone: 'Asia/Gaza'
      };

      setFormData({
        ...defaultFormData,
        ...initialData,
        membership: initialData.membership || defaultFormData.membership,
        service_areas: initialData.service_areas || [],
        categories: initialData.categories || [],
        vendor_service_areas: initialData.vendor_service_areas || [],
        delivery_zones: initialData.delivery_zones || [],
        working_hours: initialData.working_hours || defaultFormData.working_hours,
        holidays: initialData.holidays || [],
        password: '' // عدم عرض كلمة المرور عند التعديل
      });
    }

    setLocalLoading(false);
  }, [initialData]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_categories_table')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('فشل في تحميل التصنيفات');
    }
  };

  const fetchDeliveryAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('name')
        .order('name');

      if (error) {
        console.error('Error fetching delivery areas:', error);
      } else {
        const zoneNames = data.map(zone => zone.name);
        setDeliveryAreas(zoneNames);
      }
    } catch (error) {
      console.error('Error fetching delivery areas:', error);
    }
  };

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('id, name, city')
        .eq('is_active', true)
        .order('city, name');

      if (error) {
        console.error('Error fetching service areas:', error);
      } else {
        setServiceAreas(data || []);
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('membership.')) {
      const field = name.split('.')[1];
      setFormData({
        ...formData,
        membership: {
          ...formData.membership,
          [field]: type === 'number' ? parseFloat(value) : value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value
      });
    }
  };

  const handleLocationChange = (lat, lng) => {
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lng
    });
  };

  const validateCurrentStep = () => {
    // التحقق من الحقول الإلزامية في كل خطوة
    switch (currentStep) {
      case 1: // المعلومات الأساسية
        if (!formData.store_name || !formData.phone || !formData.address) {
          toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
          return false;
        }
        // التحقق من كلمة المرور عند الإضافة فقط
        if (!isEditMode && !formData.password) {
          toast.error('الرجاء إدخال كلمة المرور');
          return false;
        }
        break;

      case 2: // الموقع والتصنيفات
        if (!formData.categories || formData.categories.length === 0) {
          toast.error('الرجاء اختيار تصنيف واحد على الأقل');
          return false;
        }
        break;

      case 3: // التوصيل والأسعار
        if (formData.delivery_type === 'distance') {
          if (!formData.delivery_radius || !formData.price_per_km) {
            toast.error('الرجاء تعبئة نطاق التوصيل وسعر الكيلومتر');
            return false;
          }
        } else if (formData.delivery_type === 'zones') {
          if (!formData.delivery_zones || formData.delivery_zones.length === 0) {
            toast.error('الرجاء إضافة منطقة توصيل واحدة على الأقل');
            return false;
          }
        } else if (formData.delivery_type === 'service_areas') {
          if (!formData.vendor_service_areas || formData.vendor_service_areas.length === 0) {
            toast.error('الرجاء تحديد منطقة خدمة واحدة على الأقل');
            return false;
          }
        }
        break;

      case 5: // الصور والعضوية
        // التحقق من رفع صورة اللوغو (إلزامي عند الإضافة فقط)
        if (!isEditMode && !formData.logo_url) {
          toast.error('الرجاء رفع صورة اللوغو قبل إضافة البائع');
          return false;
        }
        if (!formData.membership.expires_at) {
          toast.error('الرجاء تحديد تاريخ انتهاء العضوية');
          return false;
        }
        break;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // التحقق من الخطوة الحالية قبل عرض نافذة التأكيد
    if (!validateCurrentStep()) {
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    const dataToSubmit = { ...formData };

    if (isEditMode && !dataToSubmit.password) {
      delete dataToSubmit.password;
    }

    await onSubmit(dataToSubmit);
    setShowConfirmation(false);
  };

  const nextStep = () => {
    // التحقق من الخطوة الحالية قبل الانتقال للخطوة التالية
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  if (localLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const ConfirmationModal = () => {
    if (!showConfirmation) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <h3 className="text-2xl font-bold text-gray-900">تأكيد البيانات</h3>
            <p className="text-sm text-gray-600 mt-1">الرجاء مراجعة البيانات قبل {isEditMode ? 'التحديث' : 'الإضافة'}</p>
          </div>

          <div className="px-6 py-4 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                المعلومات الأساسية
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div>
                  <span className="text-gray-600">اسم المتجر:</span>
                  <span className="font-semibold text-gray-900 mr-2">{formData.store_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">رقم الهاتف:</span>
                  <span className="font-semibold text-gray-900 mr-2">{formData.phone}</span>
                </div>
                {formData.email && (
                  <div>
                    <span className="text-gray-600">البريد الإلكتروني:</span>
                    <span className="font-semibold text-gray-900 mr-2">{formData.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">الحالة:</span>
                  <span className={`font-semibold mr-2 ${formData.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {formData.status === 'active' ? 'نشط' : 'غير نشط'}
                  </span>
                </div>
                {formData.address && (
                  <div className="col-span-2">
                    <span className="text-gray-600">العنوان:</span>
                    <span className="font-semibold text-gray-900 mr-2">{formData.address}</span>
                  </div>
                )}
              </div>
            </div>

            {formData.categories && formData.categories.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">التصنيفات</h4>
                <p className="text-sm text-purple-800">
                  تم تحديد {formData.categories.length} تصنيف
                </p>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">التوصيل</h4>
              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div>
                  <span className="text-gray-600">نوع التوصيل:</span>
                  <span className="font-semibold text-gray-900 mr-2">
                    {formData.delivery_type === 'distance' && 'حسب المسافة'}
                    {formData.delivery_type === 'fixed' && 'سعر ثابت'}
                    {formData.delivery_type === 'zones' && 'حسب المنطقة'}
                    {formData.delivery_type === 'service_areas' && 'مناطق الخدمة'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">وقت التوصيل المتوقع:</span>
                  <span className="font-semibold text-gray-900 mr-2">{formData.estimated_delivery_time} دقيقة</span>
                </div>
                {formData.delivery_type === 'distance' && (
                  <>
                    <div>
                      <span className="text-gray-600">نصف قطر التوصيل:</span>
                      <span className="font-semibold text-gray-900 mr-2">{formData.delivery_radius} كم</span>
                    </div>
                    <div>
                      <span className="text-gray-600">السعر لكل كم:</span>
                      <span className="font-semibold text-gray-900 mr-2">{formData.price_per_km} ₪</span>
                    </div>
                  </>
                )}
                {formData.delivery_type === 'fixed' && (
                  <div>
                    <span className="text-gray-600">سعر التوصيل الثابت:</span>
                    <span className="font-semibold text-gray-900 mr-2">{formData.min_delivery_fee} ₪</span>
                  </div>
                )}
              </div>
            </div>

            {formData.vendor_service_areas && formData.vendor_service_areas.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">مناطق الخدمة</h4>
                <p className="text-sm text-yellow-800">
                  تم تحديد {formData.vendor_service_areas.length} منطقة خدمة
                </p>
              </div>
            )}

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-2">العضوية والعمولة</h4>
              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div>
                  <span className="text-gray-600">نوع العضوية:</span>
                  <span className="font-semibold text-gray-900 mr-2">
                    {formData.membership.type === 'basic' && 'أساسية'}
                    {formData.membership.type === 'premium' && 'مميزة'}
                    {formData.membership.type === 'gold' && 'ذهبية'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">نسبة العمولة:</span>
                  <span className="font-semibold text-gray-900 mr-2">{formData.commission_rate}%</span>
                </div>
                {formData.featured && (
                  <div className="col-span-2">
                    <span className="text-green-600 font-semibold">✓ متجر مميز</span>
                  </div>
                )}
              </div>
            </div>

            {(formData.logo_url || formData.banner_url) && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <h4 className="font-semibold text-pink-900 mb-2">الصور</h4>
                <div className="flex gap-4 text-sm">
                  {formData.logo_url && <span className="text-green-600">✓ تم رفع الشعار</span>}
                  {formData.banner_url && <span className="text-green-600">✓ تم رفع صورة الغلاف</span>}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setShowConfirmation(false)}
              disabled={loading}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={loading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جارٍ الحفظ...
                </span>
              ) : (
                <>
                  {isEditMode ? '✓ تأكيد التحديث' : '✓ تأكيد الإضافة'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <ConfirmationModal />
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                onClick={() => goToStep(step.id)}
                className={`flex-1 cursor-pointer transition-all ${
                  currentStep === step.id
                    ? 'scale-105'
                    : currentStep > step.id
                    ? 'opacity-75'
                    : 'opacity-50'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 transition-colors ${
                      currentStep === step.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : currentStep > step.id
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step.id ? '✓' : step.icon}
                  </div>
                  <span
                    className={`text-sm text-center font-medium ${
                      currentStep === step.id
                        ? 'text-blue-600'
                        : currentStep > step.id
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 rounded transition-colors ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">المعلومات الأساسية</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المتجر {!isEditMode && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="text"
                  name="store_name"
                  value={formData.store_name}
                  onChange={handleChange}
                  required={!isEditMode}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل اسم المتجر"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف {!isEditMode && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required={!isEditMode}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: 0599123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني <span className="text-gray-500 text-xs">(اختياري)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@domain.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  إذا تُرك فارغًا، سيتم إنشاء بريد إلكتروني تلقائيًا باستخدام رقم الهاتف
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور {!isEditMode && <span className="text-red-600">*</span>}
                  {isEditMode && <span className="text-sm text-gray-500 mr-2">(اتركه فارغاً للاحتفاظ بالحالي)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!isEditMode}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isEditMode ? "أدخل كلمة مرور جديدة إن أردت التغيير" : "أدخل كلمة المرور"}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العنوان
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل عنوان المتجر"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="وصف المتجر ونوع الخدمات المقدمة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحالة
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نسبة العمولة (%)
                </label>
                <input
                  type="number"
                  name="commission_rate"
                  value={formData.commission_rate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">الموقع والتصنيفات</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الموقع على الخريطة
              </label>
              <MapSelector
                initialLocation={
                  formData.latitude && formData.longitude
                    ? { lat: formData.latitude, lng: formData.longitude }
                    : null
                }
                onLocationChange={handleLocationChange}
              />
              {formData.latitude && formData.longitude && (
                <p className="mt-2 text-sm text-gray-600">
                  خط العرض: {formData.latitude.toFixed(6)}, خط الطول: {formData.longitude.toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                التصنيفات
              </label>
              <CategorySelector
                availableCategories={categories}
                selectedCategories={formData.categories || []}
                onChange={(selected) =>
                  setFormData({ ...formData, categories: selected })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                منطقة الخدمة الرئيسية
                <span className="text-sm text-gray-500 mr-2">(تُستخدم للبحث في تطبيق الزبون)</span>
              </label>
              <select
                name="main_service_area_id"
                value={formData.main_service_area_id || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">اختر منطقة الخدمة الرئيسية</option>
                {serviceAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.city} - {area.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                هذه المنطقة ستُستخدم كمنطقة رئيسية للبحث في تطبيق الزبون
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                مناطق الخدمة الإضافية
              </label>
              <VendorServiceAreasSelector
                selectedAreas={formData.vendor_service_areas}
                onChange={(areas) =>
                  setFormData({ ...formData, vendor_service_areas: areas })
                }
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">التوصيل والأسعار</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                نوع التوصيل <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-all ${
                  formData.delivery_type === 'distance'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="distance"
                    checked={formData.delivery_type === 'distance'}
                    onChange={handleChange}
                    className="ml-3 text-blue-600"
                  />
                  <div>
                    <span className="font-medium">حسب المسافة</span>
                    <p className="text-sm text-gray-500 mt-1">احتساب التكلفة بناءً على المسافة بالكيلومتر</p>
                  </div>
                </label>

                <label className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-all ${
                  formData.delivery_type === 'fixed'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="fixed"
                    checked={formData.delivery_type === 'fixed'}
                    onChange={handleChange}
                    className="ml-3 text-blue-600"
                  />
                  <div>
                    <span className="font-medium">سعر ثابت</span>
                    <p className="text-sm text-gray-500 mt-1">سعر موحد لجميع الطلبات</p>
                  </div>
                </label>

                <label className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-all ${
                  formData.delivery_type === 'zones'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="zones"
                    checked={formData.delivery_type === 'zones'}
                    onChange={handleChange}
                    className="ml-3 text-blue-600"
                  />
                  <div>
                    <span className="font-medium">حسب المنطقة</span>
                    <p className="text-sm text-gray-500 mt-1">أسعار مختلفة حسب المنطقة</p>
                  </div>
                </label>

                <label className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-all ${
                  formData.delivery_type === 'service_areas'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="service_areas"
                    checked={formData.delivery_type === 'service_areas'}
                    onChange={handleChange}
                    className="ml-3 text-blue-600"
                  />
                  <div>
                    <span className="font-medium">مناطق الخدمة</span>
                    <p className="text-sm text-gray-500 mt-1">استخدام مناطق الخدمة المحددة</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.delivery_type === 'distance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نصف قطر التوصيل (كم) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      name="delivery_radius"
                      value={formData.delivery_radius}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      السعر لكل كيلومتر (₪) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      name="price_per_km"
                      value={formData.price_per_km}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الحد الأدنى لرسوم التوصيل (₪)
                    </label>
                    <input
                      type="number"
                      name="min_delivery_fee"
                      value={formData.min_delivery_fee}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رسوم التوصيل لكل كم (₪)
                    </label>
                    <input
                      type="number"
                      name="delivery_fee_per_km"
                      value={formData.delivery_fee_per_km}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {formData.delivery_type === 'fixed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سعر التوصيل الثابت (₪) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="min_delivery_fee"
                    value={formData.min_delivery_fee}
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وقت التوصيل المتوقع (دقيقة) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="estimated_delivery_time"
                  value={formData.estimated_delivery_time}
                  onChange={handleChange}
                  min="5"
                  step="5"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: 30 دقيقة"
                />
              </div>
            </div>

            {formData.delivery_type === 'zones' && (
              <div className="mt-6">
                <ZoneDeliverySelector
                  zones={formData.delivery_zones}
                  onChange={(zones) => setFormData({ ...formData, delivery_zones: zones })}
                  availableAreas={deliveryAreas}
                />
              </div>
            )}

            {formData.delivery_type === 'service_areas' && (
              <div className="mt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">استخدام مناطق الخدمة</h4>
                      <p className="text-sm text-blue-800">
                        عند اختيار هذا الخيار، يجب تحديد مناطق الخدمة في الخطوة السابقة (الموقع والتصنيفات).
                        يمكنك العودة للخطوة السابقة لتحديد المناطق وأسعارها المخصصة.
                      </p>
                    </div>
                  </div>
                </div>

                {formData.vendor_service_areas && formData.vendor_service_areas.length > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 font-medium">
                      تم تحديد {formData.vendor_service_areas.length} منطقة خدمة في الخطوة السابقة
                    </p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      لم يتم تحديد أي مناطق خدمة بعد. الرجاء العودة للخطوة السابقة لتحديد المناطق.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">أوقات الدوام والعطل</h3>

            <WorkingHoursManager
              workingHours={formData.working_hours}
              holidays={formData.holidays}
              autoStatusChange={formData.auto_status_change}
              timezone={formData.timezone}
              onChange={({ workingHours, holidays, autoStatusChange, timezone }) =>
                setFormData({
                  ...formData,
                  working_hours: workingHours,
                  holidays,
                  auto_status_change: autoStatusChange,
                  timezone
                })
              }
            />
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">الصور والعضوية</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  شعار المتجر {!isEditMode && <span className="text-red-600">*</span>}
                </label>
                <MediaUpload
                  onUpload={(data) => {
                    const url = data?.preview || data?.url || data;
                    setFormData({ ...formData, logo_url: url });
                  }}
                  currentUrl={formData.logo_url}
                  bucket={BUCKETS.VENDOR_LOGOS}
                  accept="image/*"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  صورة الغلاف
                </label>
                <MediaUpload
                  onUpload={(data) => {
                    const url = data?.preview || data?.url || data;
                    setFormData({ ...formData, banner_url: url });
                  }}
                  currentUrl={formData.banner_url}
                  bucket={BUCKETS.VENDOR_BANNERS}
                  accept="image/*"
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold mb-4 text-gray-800">العضوية</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع العضوية
                  </label>
                  <select
                    name="membership.type"
                    value={formData.membership.type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="basic">أساسية</option>
                    <option value="premium">مميزة</option>
                    <option value="gold">ذهبية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ انتهاء العضوية
                  </label>
                  <input
                    type="date"
                    name="membership.expires_at"
                    value={formData.membership.expires_at}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نسبة العمولة (%)
                  </label>
                  <input
                    type="number"
                    name="membership.commission_rate"
                    value={formData.membership.commission_rate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold mb-4 text-gray-800">المتجر المميز</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="mr-3 text-sm font-medium text-gray-700">
                    متجر مميز
                  </label>
                </div>

                {formData.featured && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        مميز حتى تاريخ
                      </label>
                      <input
                        type="date"
                        name="featured_until"
                        value={formData.featured_until}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ترتيب العرض
                      </label>
                      <input
                        type="number"
                        name="featured_order"
                        value={formData.featured_order}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold mb-4 text-gray-800">المحفظة</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="wallet_enabled"
                    checked={formData.wallet_enabled}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="mr-3 text-sm font-medium text-gray-700">
                    تفعيل المحفظة
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="auto_charge"
                    checked={formData.auto_charge}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="mr-3 text-sm font-medium text-gray-700">
                    الشحن التلقائي
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                السابق
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                التالي
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    جارٍ الحفظ...
                  </span>
                ) : (
                  isEditMode ? 'تحديث البائع' : 'إضافة البائع'
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
