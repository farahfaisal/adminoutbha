import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import MediaUpload from '../Products/MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';

export default function VendorProductCategories() {
  const [customCategories, setCustomCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [generalCategories, setGeneralCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    vendor_id: '',
    name: '',
    description: '',
    category_id: '',
    color: '#3B82F6',
    image_url: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const initialFilters = {
    search: {
      type: 'text',
      label: 'البحث',
      placeholder: 'البحث بالاسم',
      value: ''
    },
    vendor_id: {
      type: 'select',
      label: 'البائع',
      placeholder: 'جميع البائعين',
      options: vendors.map(vendor => ({
        value: vendor.id,
        label: vendor.store_name
      })),
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);
  const filteredCategories = filterData(customCategories);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [categoriesResult, vendorsResult, generalCategoriesResult] = await Promise.all([
        supabase
          .from('vendor_custom_categories')
          .select(`
            *,
            vendor:vendor_id(id, store_name),
            category:category_id(id, name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('vendors')
          .select('id, store_name')
          .eq('status', 'active')
          .order('store_name'),
        supabase
          .from('categories')
          .select('id, name')
          .order('name')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (vendorsResult.error) throw vendorsResult.error;
      if (generalCategoriesResult.error) throw generalCategoriesResult.error;

      setCustomCategories(categoriesResult.data || []);
      setVendors(vendorsResult.data || []);
      setGeneralCategories(generalCategoriesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.vendor_id || !formData.name) {
      toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      const categoryData = {
        ...formData,
        category_id: formData.category_id || null
      };

      if (formData.id) {
        const { error } = await supabase
          .from('vendor_custom_categories')
          .update(categoryData)
          .eq('id', formData.id);

        if (error) throw error;
        toast.success('تم تحديث التصنيف بنجاح');
      } else {
        categoryData.id = uuidv4();
        const { error } = await supabase
          .from('vendor_custom_categories')
          .insert([categoryData]);

        if (error) throw error;
        toast.success('تم إضافة التصنيف بنجاح');
      }

      setIsModalOpen(false);
      setFormData({
        vendor_id: '',
        name: '',
        description: '',
        category_id: '',
        color: '#3B82F6',
        image_url: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(formData.id ? 'فشل في تحديث التصنيف' : 'فشل في إضافة التصنيف');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;

    try {
      const { error } = await supabase
        .from('vendor_custom_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف التصنيف بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('فشل في حذف التصنيف');
    }
  };

  const handleImageUpload = ({ preview }) => {
    if (preview) {
      setFormData({ ...formData, image_url: preview });
    }
  };

  const handleEdit = (category) => {
    setFormData({
      id: category.id,
      vendor_id: category.vendor_id,
      name: category.name,
      description: category.description || '',
      category_id: category.category_id || '',
      color: category.color || '#3B82F6',
      image_url: category.image_url || ''
    });
    setIsModalOpen(true);
  };

  if (loading) {
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
        <div>
          <h2 className="text-2xl font-bold">تصنيفات منتجات البائعين</h2>
          <p className="text-gray-600 mt-1">إدارة التصنيفات المخصصة لمنتجات كل بائع</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              vendor_id: '',
              name: '',
              description: '',
              category_id: '',
              color: '#3B82F6',
              image_url: ''
            });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          إضافة تصنيف جديد
        </button>
      </div>

      <SearchFilter
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          {customCategories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد تصنيفات مخصصة. قم بإضافة تصنيف جديد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الصورة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الاسم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">البائع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التصنيف العام</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اللون</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCategories.map(category => (
                    <tr key={category.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="w-10 h-10 object-cover rounded"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/40?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs">لا توجد</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{category.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {category.vendor?.store_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {category.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate">
                        {category.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: category.color }}
                          ></div>
                          <span className="text-xs text-gray-500">{category.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-900 ml-4"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-2xl font-bold mb-6">
              {formData.id ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البائع <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                  disabled={formData.id}
                >
                  <option value="">اختر البائع</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.store_name}
                    </option>
                  ))}
                </select>
                {formData.id && (
                  <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير البائع بعد الإنشاء</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم التصنيف <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                  placeholder="مثال: وجبات سريعة، مشروبات ساخنة، حلويات"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التصنيف العام (اختياري)
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">بدون تصنيف عام</option>
                  {generalCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك ربط هذا التصنيف بتصنيف عام من النظام
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  rows="3"
                  placeholder="وصف التصنيف"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اللون
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 border rounded-md px-3 py-2"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  صورة التصنيف
                </label>
                <MediaUpload
                  type="image"
                  preview={formData.image_url}
                  onUpload={handleImageUpload}
                  storeInSupabase={true}
                  bucket={BUCKETS.GENERAL}
                  folder="vendor-categories"
                />
              </div>

              <div className="flex justify-end space-x-2 gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({
                      vendor_id: '',
                      name: '',
                      description: '',
                      category_id: '',
                      color: '#3B82F6',
                      image_url: ''
                    });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {formData.id ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
