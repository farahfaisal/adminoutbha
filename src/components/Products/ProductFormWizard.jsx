import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Circle } from 'lucide-react';
import MediaUpload from './MediaUpload';
import Gallery from './Gallery';
import ProductVariants from './ProductVariants';
import WholesalePrices from './WholesalePrices';
import ScheduledDiscounts from './ScheduledDiscounts';
import ProductAttributes from './ProductAttributes';
import ProductAddons from './ProductAddons';
import ImportFromCatalogButton from './ImportFromCatalogButton';

export default function ProductFormWizard({
  onSubmit,
  initialData = null,
  isVendorMode = false,
  vendorId = null,
  vendors: propVendors = null,
  categories: propCategories = null,
  product = null,
  onClose = null
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    preparation_time: '',
    wholesale_price: '',
    discount_price: '',
    scheduled_discounts: [],
    vendor_id: isVendorMode && vendorId ? vendorId : '',
    category_id: '',
    status: 'active',
    image: '',
    gallery: [],
    video: '',
    stock: 0,
    addons: [],
    type: 'regular',
    variants: [],
    wholesale_prices: [],
    attributes: [],
    is_variant_product: false,
    variants_data: [],
    ...(product || initialData || {})
  });

  const [vendors, setVendors] = useState(propVendors || []);
  const [categories, setCategories] = useState(propCategories || []);
  const [loading, setLoading] = useState(!propVendors || !propCategories);

  const steps = [
    { id: 1, title: 'المعلومات الأساسية', description: 'الاسم والوصف والتصنيف' },
    { id: 2, title: 'الصور والوسائط', description: 'الصورة الرئيسية والمعرض' },
    { id: 3, title: 'المخزون والمتغيرات', description: 'الكمية والخيارات والأسعار' },
    { id: 4, title: 'إضافات ومراجعة', description: 'الإضافات والمراجعة النهائية' }
  ];

  useEffect(() => {
    const data = product || initialData;
    if (data) {
      setFormData(prevData => ({
        ...prevData,
        ...data,
        vendor_id: isVendorMode && vendorId ? vendorId : data.vendor_id || '',
        image: data.image_url || data.image || '',
        type: data.is_variant_product ? 'variant' : 'regular',
        variants: data.variants_data || (data.addons_data?.variants || []),
        scheduled_discounts: data.scheduled_discounts || (data.addons_data?.scheduled_discounts || []),
        preparation_time: data.preparation_time || '',
        addons: data.addons || []
      }));
    }
  }, [product, initialData, isVendorMode, vendorId]);

  useEffect(() => {
    if (propVendors && propCategories) {
      setVendors(propVendors);
      setCategories(propCategories);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        if (!propVendors) {
          const { data: vendorsData, error: vendorsError } = await supabase
            .from('vendors')
            .select('id, store_name')
            .order('store_name');

          if (!vendorsError) {
            setVendors(vendorsData || []);
          }
        }

        if (!propCategories) {
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('id, name')
            .order('name');

          if (!categoriesError) {
            setCategories(categoriesData || []);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [propVendors, propCategories]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImportFromCatalog = (importedData) => {
    setFormData(prev => ({
      ...prev,
      name: importedData.name || prev.name,
      name_en: importedData.name_en || prev.name_en,
      description: importedData.description || prev.description,
      price: importedData.price || prev.price,
      image: importedData.image || prev.image,
      stock: importedData.stock || prev.stock,
      status: importedData.status || prev.status,
      variants: importedData.variants || prev.variants,
      addons: importedData.addons || prev.addons,
      type: importedData.variants && importedData.variants.length > 0 ? 'variant' : 'regular'
    }));
    toast.success('تم استيراد بيانات المنتج بنجاح! يمكنك تعديل أي حقل الآن');
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name) {
          toast.error('الرجاء إدخال اسم المنتج');
          return false;
        }
        if (!formData.category_id) {
          toast.error('الرجاء اختيار التصنيف');
          return false;
        }
        const currentVendorId = isVendorMode ? vendorId : formData.vendor_id;
        if (!currentVendorId) {
          toast.error('الرجاء اختيار المتجر');
          return false;
        }
        break;
      case 2:
        if (!formData.image) {
          toast.error('الرجاء إضافة صورة رئيسية للمنتج');
          return false;
        }
        break;
      case 3:
        if (formData.type !== 'variant') {
          if (!formData.price || parseFloat(formData.price) <= 0) {
            toast.error('الرجاء إدخال سعر صحيح');
            return false;
          }
        } else {
          if (!formData.variants || formData.variants.length === 0) {
            toast.error('الرجاء إضافة نوع واحد على الأقل للمنتج');
            return false;
          }
        }
        if (formData.stock < 0) {
          toast.error('الكمية لا يمكن أن تكون سالبة');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      const submitData = {
        ...formData,
        vendor_id: isVendorMode && vendorId ? vendorId : formData.vendor_id
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('حدث خطأ أثناء حفظ المنتج');
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep > step.id
                  ? 'bg-green-600 text-white'
                  : currentStep === step.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {currentStep > step.id ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="font-bold">{step.id}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${
                  currentStep === step.id ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 mt-[-30px] ${
                currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      {!product && !initialData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">استيراد سريع من القوائم المشتركة</h4>
              <p className="text-sm text-blue-700">
                وفر وقتك! يمكنك استيراد منتج من القوائم الجاهزة (مشروبات، حلويات، إلخ) وتعديل تفاصيله حسب احتياجك
              </p>
            </div>
            <ImportFromCatalogButton
              onImport={handleImportFromCatalog}
              isVendorMode={isVendorMode}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          اسم المنتج <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full border rounded-md px-3 py-2"
          placeholder="أدخل اسم المنتج"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          الوصف
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full border rounded-md px-3 py-2"
          rows="4"
          placeholder="أدخل وصف المنتج"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {!isVendorMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المتجر <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.vendor_id}
              onChange={(e) => handleChange('vendor_id', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">اختر المتجر</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.store_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={isVendorMode ? 'col-span-2' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            التصنيف <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.category_id}
            onChange={(e) => handleChange('category_id', e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">اختر التصنيف</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            الحالة
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="draft">مسودة</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            وقت التحضير (بالدقائق)
          </label>
          <input
            type="number"
            value={formData.preparation_time}
            onChange={(e) => handleChange('preparation_time', e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            placeholder="15"
            min="0"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          الصورة الرئيسية <span className="text-red-600">*</span>
        </label>
        <MediaUpload
          preview={formData.image}
          onUpload={(data) => {
            if (data.preview) {
              handleChange('image', data.preview);
            }
          }}
          type="image"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          معرض الصور
        </label>
        <Gallery
          images={formData.gallery || []}
          onImagesChange={(images) => handleChange('gallery', images)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          رابط الفيديو (اختياري)
        </label>
        <input
          type="url"
          value={formData.video}
          onChange={(e) => handleChange('video', e.target.value)}
          className="w-full border rounded-md px-3 py-2"
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          الكمية المتوفرة
        </label>
        <input
          type="number"
          value={formData.stock}
          onChange={(e) => handleChange('stock', e.target.value)}
          className="w-full border rounded-md px-3 py-2"
          placeholder="0"
          min="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          نوع المنتج
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="regular"
              checked={formData.type === 'regular'}
              onChange={(e) => {
                handleChange('type', e.target.value);
                handleChange('is_variant_product', false);
              }}
              className="ml-2"
            />
            منتج عادي
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="variant"
              checked={formData.type === 'variant'}
              onChange={(e) => {
                handleChange('type', e.target.value);
                handleChange('is_variant_product', true);
              }}
              className="ml-2"
            />
            منتج متعدد الأنواع
          </label>
        </div>
      </div>

      {formData.type === 'variant' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            أنواع المنتج
          </label>
          <ProductVariants
            variants={formData.variants || []}
            onUpdate={(variants) => {
              handleChange('variants', variants);
              handleChange('variants_data', variants);
            }}
            basePrice={parseFloat(formData.price) || 0}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              السعر (₪) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              سعر التخفيض (₪)
            </label>
            <input
              type="number"
              value={formData.discount_price}
              onChange={(e) => handleChange('discount_price', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              سعر الجملة (₪)
            </label>
            <input
              type="number"
              value={formData.wholesale_price}
              onChange={(e) => handleChange('wholesale_price', e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              التخفيضات المجدولة
            </label>
            <ScheduledDiscounts
              discounts={formData.scheduled_discounts || []}
              onUpdate={(discounts) => handleChange('scheduled_discounts', discounts)}
              regularPrice={parseFloat(formData.price) || 0}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              أسعار الجملة
            </label>
            <WholesalePrices
              prices={formData.wholesale_prices || []}
              onUpdate={(prices) => handleChange('wholesale_prices', prices)}
              regularPrice={parseFloat(formData.price) || 0}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          الخصائص
        </label>
        <ProductAttributes
          attributes={formData.attributes || []}
          onUpdate={(attrs) => handleChange('attributes', attrs)}
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          الإضافات
        </label>
        <ProductAddons
          addons={formData.addons || []}
          onUpdate={(addons) => handleChange('addons', addons)}
        />
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4">مراجعة المنتج</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">اسم المنتج:</span>
            <span className="font-medium">{formData.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">السعر:</span>
            <span className="font-medium">₪{formData.price || '0'}</span>
          </div>
          {formData.discount_price && (
            <div className="flex justify-between">
              <span className="text-gray-600">سعر التخفيض:</span>
              <span className="font-medium text-red-600">₪{formData.discount_price}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">الكمية:</span>
            <span className="font-medium">{formData.stock || '0'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">الحالة:</span>
            <span className={`font-medium ${
              formData.status === 'active' ? 'text-green-600' : 'text-gray-600'
            }`}>
              {formData.status === 'active' ? 'نشط' : formData.status === 'inactive' ? 'غير نشط' : 'مسودة'}
            </span>
          </div>
          {formData.image && (
            <div>
              <span className="text-gray-600">الصورة الرئيسية:</span>
              <img
                src={formData.image}
                alt="Preview"
                className="mt-2 w-32 h-32 object-cover rounded"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const content = (
    <div className="max-w-4xl mx-auto">
      {renderStepIndicator()}

      <div className="bg-white rounded-lg p-6 min-h-[500px]">
        {renderCurrentStep()}
      </div>

      <div className="flex justify-between mt-6">
        <div className="flex space-x-3 space-x-reverse">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          )}
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            السابق
          </button>
        </div>

        {currentStep === steps.length ? (
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            حفظ المنتج
          </button>
        ) : (
          <button
            onClick={nextStep}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            التالي
          </button>
        )}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
