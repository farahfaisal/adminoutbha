import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { ChevronDownIcon, FilterIcon } from 'lucide-react';
import ProductFormWizard from '../Products/ProductFormWizard';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function ProductsManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [editingInline, setEditingInline] = useState(null);
  const [inlineData, setInlineData] = useState({});
  const [quickDiscountModal, setQuickDiscountModal] = useState(null);
  const [quickDiscountData, setQuickDiscountData] = useState({ price: '', description: '' });
  const [expandedVendors, setExpandedVendors] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products with joins
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          vendor:vendor_id(id, store_name),
          category:category_id(id, name),
          product_addons(*)
        `);

      if (productsError) throw productsError;

      // تحويل product_addons إلى addons لسهولة الاستخدام
      const productsWithAddons = productsData?.map(product => ({
        ...product,
        addons: product.product_addons || []
      })) || [];
      
      // Fetch categories separately
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch vendors separately
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, store_name');
      
      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);

      setProducts(productsWithAddons);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const getFilters = () => ({
    search: {
      type: 'text',
      label: 'اسم المنتج',
      placeholder: 'البحث باسم المنتج',
      value: ''
    },
    vendor_id: {
      type: 'select',
      label: 'المتجر',
      placeholder: 'جميع المتاجر',
      options: vendors.map(vendor => ({
        value: vendor.id,
        label: vendor.store_name
      })),
      value: ''
    },
    category_id: {
      type: 'select',
      label: 'التصنيف',
      placeholder: 'جميع التصنيفات',
      options: categories.map(category => ({
        value: category.id,
        label: category.name
      })),
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'inactive', label: 'غير نشط' },
        { value: 'draft', label: 'مسودة' }
      ],
      value: ''
    },
    has_discount: {
      type: 'select',
      label: 'التخفيضات',
      placeholder: 'جميع المنتجات',
      options: [
        { value: 'yes', label: 'منتجات مخفضة فقط' },
        { value: 'no', label: 'منتجات بدون تخفيض' }
      ],
      value: ''
    }
  });

  const [filterState, setFilterState] = useState(getFilters());

  useEffect(() => {
    setFilterState(getFilters());
  }, [vendors, categories]);

  const handleFilterChange = (updates) => {
    setFilterState(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [
          key,
          { ...prev[key], value }
        ])
      )
    }));
  };

  const filteredProducts = products.filter(product => {
    return Object.entries(filterState).every(([key, filter]) => {
      if (!filter.value && filter.value !== 0) return true;

      if (key === 'search') {
        const searchTerm = filter.value.toLowerCase();
        return (
          product.name?.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm)
        );
      }

      if (key === 'vendor_id' && filter.value) {
        return product.vendor_id === filter.value;
      }

      if (key === 'category_id' && filter.value) {
        return product.category_id === filter.value;
      }

      if (key === 'status' && filter.value) {
        return product.status === filter.value;
      }

      if (key === 'has_discount' && filter.value) {
        const hasDiscount = product.discount_price != null && product.discount_price > 0;
        return filter.value === 'yes' ? hasDiscount : !hasDiscount;
      }

      return true;
    });
  });

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('admin_delete_product', {
        product_id: id
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.error || 'فشل في حذف المنتج');
        return;
      }

      toast.success('تم حذف المنتج بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('فشل في حذف المنتج');
    } finally {
      setLoading(false);
    }
  };

  const startInlineEdit = (product, field) => {
    setEditingInline({ id: product.id, field });
    setInlineData({
      ...inlineData,
      [product.id]: {
        ...(inlineData[product.id] || {}),
        [field]: product[field]
      }
    });
  };

  const handleInlineChange = (productId, field, value) => {
    setInlineData({
      ...inlineData,
      [productId]: {
        ...(inlineData[productId] || {}),
        [field]: value
      }
    });
  };

  const saveInlineEdit = async (productId) => {
    try {
      const updates = inlineData[productId];
      if (!updates) return;

      // Convert numeric fields
      if (updates.price !== undefined) updates.price = parseFloat(updates.price);
      if (updates.wholesale_price !== undefined) updates.wholesale_price = parseFloat(updates.wholesale_price) || null;
      if (updates.discount_price !== undefined) updates.discount_price = parseFloat(updates.discount_price) || null;
      if (updates.stock !== undefined) updates.stock = parseInt(updates.stock);
      if (updates.preparation_time !== undefined) updates.preparation_time = parseInt(updates.preparation_time);

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      toast.success('تم تحديث المنتج بنجاح');
      fetchData();
      setEditingInline(null);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('فشل في تحديث المنتج');
    }
  };

  const cancelInlineEdit = () => {
    setEditingInline(null);
  };

  const openQuickDiscount = (product) => {
    setQuickDiscountModal(product);
    setQuickDiscountData({
      price: product.discount_price || '',
      description: ''
    });
  };

  const handleQuickDiscount = async () => {
    if (!quickDiscountData.price || parseFloat(quickDiscountData.price) <= 0) {
      toast.error('الرجاء إدخال سعر التخفيض');
      return;
    }

    if (parseFloat(quickDiscountData.price) >= quickDiscountModal.price) {
      toast.error('سعر التخفيض يجب أن يكون أقل من السعر الأصلي');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
          discount_price: parseFloat(quickDiscountData.price)
        })
        .eq('id', quickDiscountModal.id);

      if (error) throw error;

      toast.success('تم تطبيق التخفيض بنجاح');
      setQuickDiscountModal(null);
      setQuickDiscountData({ price: '', description: '' });
      fetchData();
    } catch (error) {
      console.error('Error applying discount:', error);
      toast.error('فشل في تطبيق التخفيض');
    }
  };

  const removeQuickDiscount = async (productId) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ discount_price: null })
        .eq('id', productId);

      if (error) throw error;

      toast.success('تم إزالة التخفيض بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error removing discount:', error);
      toast.error('فشل في إزالة التخفيض');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'draft': return 'مسودة';
      default: return status;
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      
      // Prepare product data for database
      let productData = {
        id: editingProduct ? editingProduct.id : uuidv4(),
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price) || 0,
        preparation_time: parseInt(formData.preparation_time) || null,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        vendor_id: formData.vendor_id,
        category_id: formData.category_id,
        status: formData.status,
        stock: parseInt(formData.stock) || 0,
        image_url: formData.image || formData.image_url || null,
        is_variant_product: formData.is_variant_product,
        variants_data: formData.variants_data
      };

      // Handle variant products and scheduled discounts using addons_data
      let addonsData = {};

      if (formData.is_variant_product) {
        addonsData.variants = formData.variants_data;
      }

      if (formData.scheduled_discounts && formData.scheduled_discounts.length > 0) {
        addonsData.scheduled_discounts = formData.scheduled_discounts;
      }

      if (Object.keys(addonsData).length > 0) {
        productData.addons_data = addonsData;
      }

      if (editingProduct) {
        // تحديث منتج موجود
        const { data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .select();
        
        if (error) {
          console.error('Error updating product:', error);
          throw error;
        }
        
        // حذف الإضافات الحالية
        await supabase
          .from('product_addons')
          .delete()
          .eq('product_id', editingProduct.id);

        // إضافة الإضافات الجديدة
        if (formData.addons && formData.addons.length > 0) {
          const addonsData = formData.addons.map(addon => ({
            product_id: editingProduct.id,
            name: addon.name,
            price: parseFloat(addon.price),
            is_default: addon.is_default || false,
            is_required: addon.is_required || false,
            image_url: addon.image_url || null
          }));

          const { error: addonsError } = await supabase
            .from('product_addons')
            .insert(addonsData);

          if (addonsError) throw addonsError;
        }
        
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        // إضافة منتج جديد
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select();
        
        if (error) {
          console.error('Error creating product:', error);
          throw error;
        }
        
        // إضافة الإضافات (addons)
        if (formData.addons && formData.addons.length > 0 && data && data.length > 0) {
          const addonsData = formData.addons.map(addon => ({
            product_id: data[0].id,
            name: addon.name,
            price: parseFloat(addon.price),
            is_default: addon.is_default,
            is_required: addon.is_required
          }));
          
          const { error: addonsError } = await supabase
            .from('product_addons')
            .insert(addonsData);
          
          if (addonsError) throw addonsError;
        }
        
        toast.success('تم إضافة المنتج بنجاح');
      }
      
      // إعادة تحميل المنتجات
      fetchData();
      
      // إغلاق النموذج
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(editingProduct ? 'فشل في تحديث المنتج' : 'فشل في إضافة المنتج');
    } finally {
      setLoading(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="text-lg font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة المنتجات</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FilterIcon className="w-4 h-4" />
            <span>تصفية</span>
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded ${
                viewMode === 'grid'
                  ? 'bg-white shadow'
                  : 'hover:bg-gray-200'
              }`}
            >
              عرض شبكي
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded ${
                viewMode === 'table'
                  ? 'bg-white shadow'
                  : 'hover:bg-gray-200'
              }`}
            >
              عرض جدول
            </button>
            <button
              onClick={() => setViewMode('vendors')}
              className={`px-3 py-1 rounded ${
                viewMode === 'vendors'
                  ? 'bg-white shadow'
                  : 'hover:bg-gray-200'
              }`}
            >
              حسب البائعين
            </button>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة منتج جديد
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 transition-all">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {filterState.search.label}
              </label>
              <input
                type="text"
                value={filterState.search.value}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                placeholder={filterState.search.placeholder}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {filterState.category_id.label}
              </label>
              <select
                value={filterState.category_id.value}
                onChange={(e) => handleFilterChange({ category_id: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{filterState.category_id.placeholder}</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {filterState.vendor_id.label}
              </label>
              <select
                value={filterState.vendor_id.value}
                onChange={(e) => handleFilterChange({ vendor_id: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{filterState.vendor_id.placeholder}</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.store_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {filterState.status.label}
              </label>
              <select
                value={filterState.status.value}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{filterState.status.placeholder}</option>
                {filterState.status.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {filterState.has_discount.label}
              </label>
              <select
                value={filterState.has_discount.value}
                onChange={(e) => handleFilterChange({ has_discount: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{filterState.has_discount.placeholder}</option>
                {filterState.has_discount.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setFilterState(getFilters());
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 ml-2"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      )}

      {viewMode === 'vendors' ? (
        <div className="space-y-6">
          {(() => {
            // تجميع المنتجات حسب البائع
            const productsByVendor = filteredProducts.reduce((acc, product) => {
              const vendorId = product.vendor_id || 'no-vendor';
              const vendorName = product.vendor?.store_name || 'بدون بائع';

              if (!acc[vendorId]) {
                acc[vendorId] = {
                  id: vendorId,
                  name: vendorName,
                  products: []
                };
              }

              acc[vendorId].products.push(product);
              return acc;
            }, {});

            const vendorsList = Object.values(productsByVendor);

            if (vendorsList.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-gray-500">لا توجد منتجات متطابقة مع معايير البحث</p>
                </div>
              );
            }

            return vendorsList.map(vendor => {
              const isExpanded = expandedVendors.has(vendor.id);
              const totalProducts = vendor.products.length;
              const activeProducts = vendor.products.filter(p => p.status === 'active').length;
              const totalValue = vendor.products.reduce((sum, p) => sum + (p.price * p.stock), 0);
              const discountedProducts = vendor.products.filter(p => p.discount_price).length;
              const averagePrice = totalProducts > 0
                ? vendor.products.reduce((sum, p) => sum + p.price, 0) / totalProducts
                : 0;

              return (
                <div key={vendor.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {/* رأس البائع */}
                  <div
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all"
                    onClick={() => {
                      setExpandedVendors(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(vendor.id)) {
                          newSet.delete(vendor.id);
                        } else {
                          newSet.add(vendor.id);
                        }
                        return newSet;
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="bg-white text-blue-600 rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl ml-4">
                          {vendor.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{vendor.name}</h3>
                          <p className="text-blue-100 text-sm mt-1">
                            إجمالي {totalProducts} منتج • {activeProducts} نشط
                          </p>
                        </div>
                      </div>
                      <ChevronDownIcon
                        className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {/* إحصائيات سريعة */}
                    <div className="grid grid-cols-4 gap-4 mt-6">
                      <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-blue-100 text-sm">إجمالي المنتجات</div>
                        <div className="text-2xl font-bold mt-1">{totalProducts}</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-blue-100 text-sm">متوسط السعر</div>
                        <div className="text-2xl font-bold mt-1">₪{averagePrice.toFixed(2)}</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-blue-100 text-sm">قيمة المخزون</div>
                        <div className="text-2xl font-bold mt-1">₪{totalValue.toFixed(2)}</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-blue-100 text-sm">منتجات مخفضة</div>
                        <div className="text-2xl font-bold mt-1">{discountedProducts}</div>
                      </div>
                    </div>
                  </div>

                  {/* منتجات البائع */}
                  {isExpanded && (
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vendor.products.map(product => (
                          <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${getStatusColor(product.status)}`}>
                                  {getStatusText(product.status)}
                                </span>
                              </div>
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-16 h-16 rounded-lg object-cover mr-3"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/64?text=No+Image';
                                  }}
                                />
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              {product.discount_price ? (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm line-through text-gray-400">₪{product.price}</span>
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">
                                      -{((1 - product.discount_price / product.price) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="text-xl font-bold text-red-600">₪{product.discount_price}</div>
                                </div>
                              ) : (
                                <div className="text-xl font-bold text-green-600">₪{product.price}</div>
                              )}

                              <div className="flex items-center justify-between text-sm text-gray-500">
                                <span>المخزون: {product.stock}</span>
                                <span>{product.category?.name || '-'}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setShowModal(true);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDelete(product.id)}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  حذف
                                </button>
                              </div>
                              {product.discount_price ? (
                                <button
                                  onClick={() => removeQuickDiscount(product.id)}
                                  className="text-xs text-orange-600 hover:text-orange-800"
                                >
                                  إزالة التخفيض
                                </button>
                              ) : (
                                <button
                                  onClick={() => openQuickDiscount(product)}
                                  className="text-xs text-green-600 hover:text-green-800"
                                >
                                  تخفيض سريع
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">لا توجد منتجات متطابقة مع معايير البحث</p>
            </div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {product.image_url && (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                    }}
                  />
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(product.status)}`}>
                      {getStatusText(product.status)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                  <div className="space-y-2">
                    {product.discount_price && product.discount_price > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm line-through text-gray-400">
                            ₪{product.price}
                          </p>
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold">
                            خصم {((1 - product.discount_price / product.price) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">₪{product.discount_price}</p>
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-green-600">₪{product.price}</p>
                    )}
                    {product.wholesale_price && (
                      <p className="text-sm text-gray-500">
                        سعر الجملة: ₪{product.wholesale_price}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      المخزون: {product.stock} قطعة
                    </p>
                    <p className="text-sm text-gray-500">
                      وقت التحضير: {product.preparation_time || 'غير محدد'} دقيقة
                    </p>
                    <p className="text-sm text-gray-500">
                      المتجر: {product.vendor?.store_name || 'غير محدد'}
                    </p>
                    <p className="text-sm text-gray-500">
                      التصنيف: {product.category?.name || 'غير محدد'}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        حذف
                      </button>
                    </div>
                    <div className="flex justify-end space-x-2">
                      {product.discount_price ? (
                        <button
                          onClick={() => removeQuickDiscount(product.id)}
                          className="text-xs text-orange-600 hover:text-orange-800 ml-2"
                        >
                          إزالة التخفيض
                        </button>
                      ) : (
                        <button
                          onClick={() => openQuickDiscount(product)}
                          className="text-xs text-green-600 hover:text-green-800 ml-2"
                        >
                          تخفيض سريع
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المنتج</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السعر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وقت التحضير</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر الجملة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر التخفيض</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المخزون</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التصنيف</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-4 text-center text-gray-500">
                      لا توجد منتجات متطابقة مع معايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-10 h-10 rounded-full object-cover ml-3"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/40?text=No+Image';
                              }}
                            />
                          )}
                          <div>
                            {editingInline?.id === product.id && editingInline?.field === 'name' ? (
                              <input
                                type="text"
                                value={inlineData[product.id]?.name || product.name}
                                onChange={(e) => handleInlineChange(product.id, 'name', e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm"
                                autoFocus
                              />
                            ) : (
                              <div 
                                className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                onClick={() => startInlineEdit(product, 'name')}
                              >
                                {product.name}
                              </div>
                            )}
                            {editingInline?.id === product.id && editingInline?.field === 'description' ? (
                              <textarea
                                value={inlineData[product.id]?.description || product.description || ''}
                                onChange={(e) => handleInlineChange(product.id, 'description', e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm mt-1"
                                rows="2"
                                autoFocus
                              />
                            ) : (
                              <div 
                                className="text-gray-500 cursor-pointer hover:text-blue-600"
                                onClick={() => startInlineEdit(product, 'description')}
                              >
                                {product.description || 'إضافة وصف'}
                              </div>
                            )}
                            {product.is_variant_product && (
                              <div className="mt-1 text-xs text-blue-600">
                                منتج متعدد الأنواع ({product.variants_data?.length || 0} نوع)
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'price' ? (
                          <input
                            type="number"
                            value={inlineData[product.id]?.price || product.price}
                            onChange={(e) => handleInlineChange(product.id, 'price', e.target.value)}
                            className="w-24 border rounded-md px-2 py-1 text-sm"
                            min="0"
                            step="0.01"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-lg font-semibold text-green-600 cursor-pointer hover:text-blue-600"
                            onClick={() => startInlineEdit(product, 'price')}
                          >
                            ₪{product.price}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'preparation_time' ? (
                          <input
                            type="number"
                            value={inlineData[product.id]?.preparation_time || product.preparation_time || ''}
                            onChange={(e) => handleInlineChange(product.id, 'preparation_time', e.target.value)}
                            className="w-24 border rounded-md px-2 py-1 text-sm"
                            min="1"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-gray-600 cursor-pointer hover:text-blue-600"
                            onClick={() => startInlineEdit(product, 'preparation_time')}
                          >
                            {product.preparation_time || 'غير محدد'} دقيقة
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'wholesale_price' ? (
                          <input
                            type="number"
                            value={inlineData[product.id]?.wholesale_price || product.wholesale_price || ''}
                            onChange={(e) => handleInlineChange(product.id, 'wholesale_price', e.target.value)}
                            className="w-24 border rounded-md px-2 py-1 text-sm"
                            min="0"
                            step="0.01"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-gray-500 cursor-pointer hover:text-blue-600"
                            onClick={() => startInlineEdit(product, 'wholesale_price')}
                          >
                            {product.wholesale_price ? `₪${product.wholesale_price}` : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'discount_price' ? (
                          <input
                            type="number"
                            value={inlineData[product.id]?.discount_price || product.discount_price || ''}
                            onChange={(e) => handleInlineChange(product.id, 'discount_price', e.target.value)}
                            className="w-24 border rounded-md px-2 py-1 text-sm"
                            min="0"
                            step="0.01"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-red-500 cursor-pointer hover:text-blue-600"
                            onClick={() => startInlineEdit(product, 'discount_price')}
                          >
                            {product.discount_price ? `₪${product.discount_price}` : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'stock' ? (
                          <input
                            type="number"
                            value={inlineData[product.id]?.stock || product.stock}
                            onChange={(e) => handleInlineChange(product.id, 'stock', e.target.value)}
                            className="w-24 border rounded-md px-2 py-1 text-sm"
                            min="0"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-gray-500 cursor-pointer hover:text-blue-600"
                            onClick={() => startInlineEdit(product, 'stock')}
                          >
                            {product.stock} قطعة
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {product.vendor?.store_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingInline?.id === product.id && editingInline?.field === 'status' ? (
                          <select
                            value={inlineData[product.id]?.status || product.status}
                            onChange={(e) => handleInlineChange(product.id, 'status', e.target.value)}
                            className="border rounded-md px-2 py-1 text-sm"
                            autoFocus
                          >
                            <option value="active">نشط</option>
                            <option value="inactive">غير نشط</option>
                            <option value="draft">مسودة</option>
                          </select>
                        ) : (
                          <span 
                            className={`px-2 py-1 text-xs rounded-full cursor-pointer ${getStatusColor(product.status)}`}
                            onClick={() => startInlineEdit(product, 'status')}
                          >
                            {getStatusText(product.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingInline?.id === product.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveInlineEdit(product.id)}
                              className="text-green-600 hover:text-green-800 ml-2"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-1">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditingProduct(product);
                                  setShowModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 ml-2"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                حذف
                              </button>
                            </div>
                            <div className="flex space-x-2">
                              {product.discount_price ? (
                                <button
                                  onClick={() => removeQuickDiscount(product.id)}
                                  className="text-xs text-orange-600 hover:text-orange-800"
                                >
                                  إزالة التخفيض
                                </button>
                              ) : (
                                <button
                                  onClick={() => openQuickDiscount(product)}
                                  className="text-xs text-green-600 hover:text-green-800"
                                >
                                  تخفيض سريع
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProduct(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-start justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white w-full min-h-screen">
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <Dialog.Title className="text-2xl font-bold">
                  {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
                </Dialog.Title>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                  }}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <ProductFormWizard
                initialData={editingProduct}
                onSubmit={handleFormSubmit}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Quick Discount Modal */}
      <Dialog
        open={!!quickDiscountModal}
        onClose={() => {
          setQuickDiscountModal(null);
          setQuickDiscountData({ price: '', description: '' });
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-bold mb-4">
              تخفيض سريع - {quickDiscountModal?.name}
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السعر الأصلي
                </label>
                <div className="text-2xl font-bold text-gray-900">
                  ₪{quickDiscountModal?.price}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر التخفيض (₪) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={quickDiscountData.price}
                  onChange={(e) => setQuickDiscountData({ ...quickDiscountData, price: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                  placeholder="أدخل سعر التخفيض"
                />
                <p className="text-xs text-gray-500 mt-1">
                  يجب أن يكون أقل من السعر الأصلي
                </p>
              </div>

              {quickDiscountData.price && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm text-gray-700">
                    نسبة التخفيض:
                    <span className="font-bold text-green-600 mr-1">
                      {((1 - parseFloat(quickDiscountData.price) / quickDiscountModal?.price) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    التوفير:
                    <span className="font-bold text-green-600 mr-1">
                      ₪{(quickDiscountModal?.price - parseFloat(quickDiscountData.price)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setQuickDiscountModal(null);
                  setQuickDiscountData({ price: '', description: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 ml-2"
              >
                إلغاء
              </button>
              <button
                onClick={handleQuickDiscount}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                تطبيق التخفيض
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Help tooltip for inline editing */}
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-xs">
        <h4 className="font-bold mb-2">تلميح: التعديل السريع</h4>
        <p className="text-sm">
          يمكنك النقر مباشرة على أي حقل في العرض الجدولي للتعديل السريع، ثم الضغط على زر "حفظ" لتأكيد التغييرات.
        </p>
      </div>
    </div>
  );
}