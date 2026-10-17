import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import MediaUpload from './MediaUpload';
import Gallery from './Gallery';
import ProductVariants from './ProductVariants';
import WholesalePrices from './WholesalePrices';
import ScheduledDiscounts from './ScheduledDiscounts';
import ProductAttributes from './ProductAttributes';
import ProductAddons from './ProductAddons';
import ImportFromCatalogButton from './ImportFromCatalogButton';

export default function ProductForm({ onSubmit, initialData = null }) {
  // Initialize form data with initial values or defaults
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    preparation_time: '', // No default value, must be entered manually
    wholesale_price: '',
    discount_price: '',
    scheduled_discounts: [],
    vendor_id: '',
    category_id: '',
    custom_category_id: '',
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
    ...initialData
  });

  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(prevData => ({
        ...prevData,
        ...initialData,
        image: initialData.image_url || '',
        type: initialData.is_variant_product ? 'variant' : 'regular',
        variants: initialData.variants_data || (initialData.addons_data?.variants || []),
        scheduled_discounts: initialData.scheduled_discounts || (initialData.addons_data?.scheduled_discounts || []),
        preparation_time: initialData.preparation_time || '',
        custom_category_id: initialData.custom_category_id || ''
      }));
    }
  }, [initialData]);

  // Fetch custom categories when vendor changes
  useEffect(() => {
    const fetchCustomCategories = async () => {
      if (!formData.vendor_id) {
        setCustomCategories([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendor_custom_categories')
          .select('id, name')
          .eq('vendor_id', formData.vendor_id)
          .order('name');

        if (error) {
          console.error('Error fetching custom categories:', error);
          setCustomCategories([]);
        } else {
          setCustomCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching custom categories:', error);
        setCustomCategories([]);
      }
    };

    fetchCustomCategories();
  }, [formData.vendor_id]);

  // Fetch vendors and categories from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch vendors
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, store_name')
          .order('store_name');
        
        if (vendorsError) {
          console.error('Error fetching vendors:', vendorsError);
          // Fallback to mock data if API fails
          setVendors([
            { id: 1, store_name: 'متجر كوفي' },
            { id: 2, store_name: 'متجر الشاي' },
            { id: 3, store_name: 'متجر العصائر' }
          ]);
        } else {
          setVendors(vendorsData || []);
        }
        
        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name')
          .order('name');
        
        if (categoriesError) {
          console.error('Error fetching categories:', categoriesError);
          // Fallback to mock data if API fails
          setCategories([
            { id: 1, name: 'مشروبات ساخنة' },
            { id: 2, name: 'عصائر' },
            { id: 3, name: 'حلويات' }
          ]);
        } else {
          setCategories(categoriesData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data
        setVendors([
          { id: 1, store_name: 'متجر كوفي' },
          { id: 2, store_name: 'متجر الشاي' },
          { id: 3, store_name: 'متجر العصائر' }
        ]);
        setCategories([
          { id: 1, name: 'مشروبات ساخنة' },
          { id: 2, name: 'عصائر' },
          { id: 3, name: 'حلويات' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!formData.name || !formData.vendor_id || !formData.category_id) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        return;
      }
      
      // Validate price for regular products
      if (formData.type === 'regular' && !formData.price) {
        toast.error('الرجاء إدخال سعر المنتج');
        return;
      }
      
      // Validate variants for variant products
      if (formData.type === 'variant' && (!formData.variants || formData.variants.length === 0)) {
        toast.error('الرجاء إضافة نوع واحد على الأقل للمنتج');
        return;
      }
      
      // Preparation time is now optional, no validation needed
      
      // Prepare data for submission
      const productData = {
        ...formData,
        // Set variant product flag based on type
        is_variant_product: formData.type === 'variant',
        // For variant products, set the main price to the lowest variant price
        price: formData.type === 'variant' && formData.variants.length > 0
          ? Math.min(...formData.variants.map(v => parseFloat(v.price) || 0))
          : parseFloat(formData.price) || 0,
        // Convert string values to appropriate types
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        stock: parseInt(formData.stock) || 0,
        preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : null,
        // Handle custom category - convert empty string to null
        custom_category_id: formData.custom_category_id || null,
        // Store variants data in both fields for compatibility
        addons_data: formData.type === 'variant' ? { variants: formData.variants } : null,
        variants_data: formData.type === 'variant' ? formData.variants : [],
        image_url: formData.image,
        // Add variant display information for the first variant
        variant_name: formData.type === 'variant' && formData.variants.length > 0 ? formData.variants[0].name : null,
        variant_price: formData.type === 'variant' && formData.variants.length > 0 ? parseFloat(formData.variants[0].price) : null,
        variant_image_url: formData.type === 'variant' && formData.variants.length > 0 ? formData.variants[0].image_url : null
      };
      
      onSubmit(productData);
    } catch (error) {
      console.error('Error preparing product data:', error);
      toast.error('حدث خطأ أثناء معالجة بيانات المنتج');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!initialData && (
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
              isVendorMode={false}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            نوع المنتج
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="regular"
                checked={formData.type === 'regular'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="ml-2"
              />
              منتج عادي
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="variant"
                checked={formData.type === 'variant'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="ml-2"
              />
              منتج متعدد الأنواع
            </label>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الصورة المميزة
          </label>
          <MediaUpload
            type="image"
            preview={formData.image || formData.image_url}
            onUpload={({ preview }) => setFormData({ ...formData, image: preview })}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            معرض الصور
          </label>
          <Gallery
            images={formData.gallery}
            onUpdate={(gallery) => setFormData({ ...formData, gallery })}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            فيديو المنتج
          </label>
          <MediaUpload
            type="video"
            preview={formData.video}
            onUpload={({ preview }) => setFormData({ ...formData, video: preview })}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            اسم المنتج <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الوصف
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
            rows="3"
          />
        </div>

        {formData.type === 'regular' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السعر (₪) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وقت التحضير (دقيقة)
                </label>
                <input
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="1"
                  max="180"
                  placeholder="اختياري"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر الجملة (₪)
                </label>
                <input
                  type="number"
                  value={formData.wholesale_price}
                  onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">اختياري</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر التخفيض الحالي (₪)
                </label>
                <input
                  type="number"
                  value={formData.discount_price}
                  onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">اختياري</p>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <ScheduledDiscounts
                discounts={formData.scheduled_discounts}
                onChange={(discounts) => setFormData({ ...formData, scheduled_discounts: discounts })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المخزون <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                className="w-full border rounded-md px-3 py-2"
                min="0"
                required
              />
            </div>
          </>
        ) : (
          <div className="col-span-1 md:col-span-2">
            <ProductVariants
              variants={formData.variants}
              onChange={(variants) => {
                setFormData({ ...formData, variants });
                console.log('Updated variants:', variants);
              }}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            المتجر <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.vendor_id}
            onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value, custom_category_id: '' })}
            className="w-full border rounded-md px-3 py-2"
            required
            disabled={loading}
          >
            <option value="">اختر المتجر</option>
            {vendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.store_name}
              </option>
            ))}
          </select>
          {loading && <p className="text-sm text-gray-500 mt-1">جاري تحميل المتاجر...</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            التصنيف العام <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
            required
            disabled={loading}
          >
            <option value="">اختر التصنيف</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {loading && <p className="text-sm text-gray-500 mt-1">جاري تحميل التصنيفات...</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            التصنيف المخصص (اختياري)
          </label>
          <select
            value={formData.custom_category_id}
            onChange={(e) => setFormData({ ...formData, custom_category_id: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
            disabled={!formData.vendor_id}
          >
            <option value="">بدون تصنيف مخصص</option>
            {customCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {!formData.vendor_id && (
            <p className="text-xs text-gray-500 mt-1">اختر المتجر أولاً</p>
          )}
          {formData.vendor_id && customCategories.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">لا توجد تصنيفات مخصصة لهذا المتجر</p>
          )}
        </div>

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
            <option value="draft">مسودة</option>
          </select>
        </div>

        <div className="col-span-1 md:col-span-2">
          <WholesalePrices
            prices={formData.wholesale_prices}
            onChange={(prices) => setFormData({ ...formData, wholesale_prices: prices })}
          />
          <p className="text-xs text-gray-500 mt-1">أسعار الجملة اختيارية</p>
        </div>

        <div className="col-span-1 md:col-span-2">
          <ProductAttributes
            attributes={formData.attributes}
            onChange={(attributes) => setFormData({ ...formData, attributes })}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <ProductAddons
            addons={formData.addons}
            onChange={(addons) => setFormData({ ...formData, addons })}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {initialData ? 'تحديث' : 'إضافة'}
        </button>
      </div>
    </form>
  );
}