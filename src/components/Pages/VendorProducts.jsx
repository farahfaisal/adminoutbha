import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowRightIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TagIcon,
  CubeIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import ProductFormWizard from '../Products/ProductFormWizard';

export default function VendorProducts() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [quickEditingProduct, setQuickEditingProduct] = useState(null);
  const [quickOfferProduct, setQuickOfferProduct] = useState(null);
  const [serviceAreas, setServiceAreas] = useState([]);

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
      fetchServiceAreas();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      setLoading(true);

      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .maybeSingle();

      if (vendorError) throw vendorError;
      if (!vendorData) {
        toast.error('البائع غير موجود');
        navigate('/admin-dashboard/vendor-products-management');
        return;
      }

      setVendor(vendorData);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast.error('حدث خطأ في جلب بيانات البائع');
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_service_areas')
        .select(`
          *,
          service_area:service_areas(
            id,
            name,
            city,
            delivery_price
          )
        `)
        .eq('vendor_id', vendorId);

      if (error) throw error;

      setServiceAreas(data || []);
    } catch (error) {
      console.error('Error fetching service areas:', error);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    try {
      const { data, error } = await supabase.rpc('admin_delete_product', {
        product_id: productId
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.error || 'حدث خطأ في حذف المنتج');
        return;
      }

      toast.success('تم حذف المنتج بنجاح');
      fetchVendorData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('حدث خطأ في حذف المنتج');
    }
  };

  const handleToggleStatus = async (productId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId);

      if (error) throw error;

      toast.success(`تم ${newStatus === 'active' ? 'تفعيل' : 'إلغاء تفعيل'} المنتج`);
      fetchVendorData();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('حدث خطأ في تحديث حالة المنتج');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'نشط', color: 'bg-green-100 text-green-800' },
      inactive: { label: 'غير نشط', color: 'bg-gray-100 text-gray-800' },
      draft: { label: 'مسودة', color: 'bg-yellow-100 text-yellow-800' }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleQuickEdit = async (productId, field, value) => {
    try {
      const updateData = {};
      if (field === 'price' || field === 'stock') {
        updateData[field] = parseFloat(value) || 0;
      } else {
        updateData[field] = value;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;

      toast.success('تم تحديث المنتج بنجاح');
      fetchVendorData();
      setQuickEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('حدث خطأ في تحديث المنتج');
    }
  };

  const handleQuickOffer = async (productId, discountPrice) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ discount_price: parseFloat(discountPrice) || null })
        .eq('id', productId);

      if (error) throw error;

      toast.success('تم إضافة العرض الخاص بنجاح');
      fetchVendorData();
      setQuickOfferProduct(null);
    } catch (error) {
      console.error('Error adding offer:', error);
      toast.error('حدث خطأ في إضافة العرض');
    }
  };

  const handleProductSubmit = async (formData) => {
    try {
      const isVariantProduct = formData.is_variant_product || formData.type === 'variant';
      const basePrice = isVariantProduct && formData.variants && formData.variants.length > 0
        ? formData.variants[0].price
        : parseFloat(formData.price) || 0;

      const productData = {
        name: formData.name,
        description: formData.description,
        price: basePrice,
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : null,
        vendor_id: formData.vendor_id || vendorId,
        category_id: formData.category_id,
        status: formData.status,
        image_url: formData.image,
        stock: parseInt(formData.stock) || 0,
        is_variant_product: isVariantProduct,
        variants_data: formData.variants || [],
        addons_data: {
          variants: formData.variants || [],
          addons: formData.addons || [],
          scheduled_discounts: formData.scheduled_discounts || [],
          wholesale_prices: formData.wholesale_prices || [],
          attributes: formData.attributes || [],
          gallery: formData.gallery || []
        }
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        toast.success('تم إضافة المنتج بنجاح');
      }

      setShowProductForm(false);
      setEditingProduct(null);
      fetchVendorData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('حدث خطأ في حفظ المنتج');
      throw error;
    }
  };

  if (showProductForm) {
    return (
      <ProductFormWizard
        vendorId={vendorId}
        product={editingProduct}
        isVendorMode={true}
        onSubmit={handleProductSubmit}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(null);
          fetchVendorData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin-dashboard/vendor-products-management')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowRightIcon className="w-5 h-5 text-gray-600" />
            </button>

            {vendor && (
              <div className="flex items-center gap-3">
                {vendor.logo_url ? (
                  <img
                    src={vendor.logo_url}
                    alt={vendor.store_name}
                    className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xl font-bold">
                    {vendor.store_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{vendor.store_name}</h1>
                  <p className="text-sm text-gray-600">{vendor.phone}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setEditingProduct(null);
              setShowProductForm(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
            إضافة منتج جديد
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="draft">مسودة</option>
          </select>

          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableCellsIcon className="w-5 h-5" />
              جدول
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Squares2X2Icon className="w-5 h-5" />
              شبكة
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">جاري تحميل المنتجات...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">لا توجد منتجات</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">المنتج</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">التصنيف</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">السعر</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">المخزون</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">الحالة</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-xs">لا توجد صورة</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {product.categories?.name || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{Number(product.price).toFixed(2)} ₪</p>
                      {product.discount_price && (
                        <p className="text-xs text-green-600">خصم: {Number(product.discount_price).toFixed(2)} ₪</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-medium ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(product.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(product.id, product.status)}
                          className={`p-2 rounded-lg transition-colors ${
                            product.status === 'active'
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                              : 'bg-green-100 hover:bg-green-200 text-green-600'
                          }`}
                          title={product.status === 'active' ? 'إلغاء التفعيل' : 'تفعيل'}
                        >
                          {product.status === 'active' ? (
                            <EyeSlashIcon className="w-5 h-5" />
                          ) : (
                            <EyeIcon className="w-5 h-5" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowProductForm(true);
                          }}
                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-48 bg-gray-100">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CubeIcon className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(product.status)}
                  </div>
                  {product.discount_price && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <TagIcon className="w-4 h-4" />
                      عرض خاص
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-1 mb-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {product.description || 'لا يوجد وصف'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {product.categories?.name || 'غير محدد'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      {quickEditingProduct === product.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.price}
                            className="w-24 px-2 py-1 border border-blue-500 rounded text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleQuickEdit(product.id, 'price', e.target.value);
                              } else if (e.key === 'Escape') {
                                setQuickEditingProduct(null);
                              }
                            }}
                          />
                          <button
                            onClick={() => setQuickEditingProduct(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {Number(product.price).toFixed(2)} ₪
                            </span>
                            <button
                              onClick={() => setQuickEditingProduct(product.id)}
                              className="text-blue-600 hover:text-blue-700"
                              title="تعديل السعر"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          </div>
                          {product.discount_price && (
                            <p className="text-sm text-green-600 font-semibold">
                              العرض: {Number(product.discount_price).toFixed(2)} ₪
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-500">المخزون</p>
                      <p className={`text-xl font-bold ${
                        product.stock > 10 ? 'text-green-600' :
                        product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {product.stock}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (quickOfferProduct === product.id) {
                          setQuickOfferProduct(null);
                        } else {
                          setQuickOfferProduct(product.id);
                        }
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all text-sm font-medium"
                    >
                      <TagIcon className="w-4 h-4" />
                      عرض خاص
                    </button>
                    <button
                      onClick={() => handleToggleStatus(product.id, product.status)}
                      className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                        product.status === 'active'
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {product.status === 'active' ? (
                        <>
                          <EyeSlashIcon className="w-4 h-4" />
                          إخفاء
                        </>
                      ) : (
                        <>
                          <EyeIcon className="w-4 h-4" />
                          تفعيل
                        </>
                      )}
                    </button>
                  </div>

                  {quickOfferProduct === product.id && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        سعر العرض الخاص
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={product.discount_price || ''}
                          placeholder="السعر بعد الخصم"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleQuickOffer(product.id, e.target.value);
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = e.target.parentElement.querySelector('input');
                            handleQuickOffer(product.id, input.value);
                          }}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                        >
                          حفظ
                        </button>
                      </div>
                      <button
                        onClick={() => setQuickOfferProduct(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setShowProductForm(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium"
                    >
                      <PencilIcon className="w-4 h-4" />
                      تعديل كامل
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-4">إحصائيات المنتجات</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">إجمالي المنتجات</p>
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">منتجات نشطة</p>
            <p className="text-2xl font-bold text-green-600">
              {products.filter(p => p.status === 'active').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">منتجات غير نشطة</p>
            <p className="text-2xl font-bold text-gray-600">
              {products.filter(p => p.status === 'inactive').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">مسودات</p>
            <p className="text-2xl font-bold text-yellow-600">
              {products.filter(p => p.status === 'draft').length}
            </p>
          </div>
        </div>
      </div>

      {serviceAreas.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg shadow-sm p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <MapPinIcon className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-900">مناطق الخدمة</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceAreas.map((area) => (
              <div
                key={area.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{area.service_area?.name}</h4>
                    <p className="text-sm text-gray-600">{area.service_area?.city}</p>
                  </div>
                  <MapPinIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">سعر التوصيل الأساسي:</span>
                    <span className="font-semibold text-gray-900">
                      {Number(area.service_area?.delivery_price || 0).toFixed(2)} ₪
                    </span>
                  </div>
                  {area.custom_delivery_price && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">سعر التوصيل المخصص:</span>
                      <span className="font-semibold text-blue-600">
                        {Number(area.custom_delivery_price).toFixed(2)} ₪
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
