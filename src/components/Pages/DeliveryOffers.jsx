import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import MediaUpload from '../Products/MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';

export default function DeliveryOffers() {
  const [offers, setOffers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    max_discount: null,
    vendor_id: null,
    category_id: null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    status: 'active',
    usage_limit: null,
    image_url: '',
    background_color: '#FF6B35',
    text_color: '#FFFFFF'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [offersRes, vendorsRes, categoriesRes] = await Promise.all([
        supabase
          .from('delivery_offers')
          .select(`
            *,
            vendor:vendor_id(id, store_name),
            category:category_id(id, name)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('vendors').select('id, store_name').order('store_name'),
        supabase.from('categories').select('id, name').order('name')
      ]);

      if (offersRes.error) throw offersRes.error;
      if (vendorsRes.error) throw vendorsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setOffers(offersRes.data || []);
      setVendors(vendorsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title) {
      toast.error('الرجاء إدخال عنوان العرض');
      return;
    }

    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
      return;
    }

    try {
      setLoading(true);

      const offerData = {
        ...formData,
        vendor_id: formData.vendor_id || null,
        category_id: formData.category_id || null,
        max_discount: formData.max_discount || null,
        usage_limit: formData.usage_limit || null
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('delivery_offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;
        toast.success('تم تحديث العرض بنجاح');
      } else {
        const { error } = await supabase
          .from('delivery_offers')
          .insert([offerData]);

        if (error) throw error;
        toast.success('تم إضافة العرض بنجاح');
      }

      setShowModal(false);
      setEditingOffer(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving offer:', error);
      toast.error('فشل في حفظ العرض');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('delivery_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف العرض بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error('فشل في حذف العرض');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      max_discount: null,
      vendor_id: null,
      category_id: null,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      status: 'active',
      usage_limit: null,
      image_url: '',
      background_color: '#FF6B35',
      text_color: '#FFFFFF'
    });
  };

  const openEditModal = (offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description || '',
      discount_type: offer.discount_type,
      discount_value: offer.discount_value,
      min_order_amount: offer.min_order_amount,
      max_discount: offer.max_discount,
      vendor_id: offer.vendor_id,
      category_id: offer.category_id,
      start_date: offer.start_date,
      end_date: offer.end_date,
      status: offer.status,
      usage_limit: offer.usage_limit,
      image_url: offer.image_url || '',
      background_color: offer.background_color,
      text_color: offer.text_color
    });
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800'
    };
    const labels = {
      active: 'نشط',
      inactive: 'غير نشط',
      expired: 'منتهي'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badges[status] || badges.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getDiscountText = (offer) => {
    if (offer.discount_type === 'percentage') {
      return `${offer.discount_value}%`;
    } else {
      return `${offer.discount_value} ₪`;
    }
  };

  if (loading && offers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">عروض التوصيل</h1>
        <button
          onClick={() => {
            setEditingOffer(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <PlusIcon className="w-5 h-5" />
          إضافة عرض جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="bg-white rounded-lg shadow-md overflow-hidden"
            style={{ borderTop: `4px solid ${offer.background_color}` }}
          >
            {offer.image_url && (
              <img
                src={offer.image_url}
                alt={offer.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold">{offer.title}</h3>
                {getStatusBadge(offer.status)}
              </div>

              {offer.description && (
                <p className="text-gray-600 text-sm mb-3">{offer.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">الخصم:</span>
                  <span className="font-bold text-green-600">{getDiscountText(offer)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">الحد الأدنى للطلب:</span>
                  <span className="font-medium">{offer.min_order_amount} ₪</span>
                </div>

                {offer.max_discount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">الحد الأقصى للخصم:</span>
                    <span className="font-medium">{offer.max_discount} ₪</span>
                  </div>
                )}

                {offer.vendor && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">المتجر:</span>
                    <span className="font-medium">{offer.vendor.store_name}</span>
                  </div>
                )}

                {offer.category && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">التصنيف:</span>
                    <span className="font-medium">{offer.category.name}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">الفترة:</span>
                  <span className="font-medium text-xs">
                    {new Date(offer.start_date).toLocaleDateString('ar')} - {new Date(offer.end_date).toLocaleDateString('ar')}
                  </span>
                </div>

                {offer.usage_limit && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">الاستخدام:</span>
                    <span className="font-medium">{offer.used_count} / {offer.usage_limit}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => openEditModal(offer)}
                  className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600"
                >
                  <PencilIcon className="w-4 h-4" />
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(offer.id)}
                  className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-600"
                >
                  <TrashIcon className="w-4 h-4" />
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {offers.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">لا توجد عروض توصيل</p>
          <button
            onClick={() => {
              setEditingOffer(null);
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            إضافة عرض جديد
          </button>
        </div>
      )}

      <Dialog open={showModal} onClose={() => setShowModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <Dialog.Title className="text-xl font-bold">
                {editingOffer ? 'تعديل عرض التوصيل' : 'إضافة عرض توصيل جديد'}
              </Dialog.Title>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عنوان العرض
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نوع الخصم
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="percentage">نسبة مئوية</option>
                    <option value="fixed">مبلغ ثابت</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    قيمة الخصم
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الحد الأدنى للطلب (₪)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الحد الأقصى للخصم (₪)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_discount || ''}
                    onChange={(e) => setFormData({ ...formData, max_discount: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    المتجر (اختياري)
                  </label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || null })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">جميع المتاجر</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.store_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    التصنيف (اختياري)
                  </label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value || null })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">جميع التصنيفات</option>
                    {categories.map((category) => (
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
                    تاريخ البدء
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    تاريخ الانتهاء
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الحالة
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    حد الاستخدام (اختياري)
                  </label>
                  <input
                    type="number"
                    value={formData.usage_limit || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  صورة العرض
                </label>
                <MediaUpload
                  bucket={BUCKETS.ADVERTISEMENTS}
                  path="delivery-offers"
                  onUpload={(url) => setFormData({ ...formData, image_url: url })}
                  currentImage={formData.image_url}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    لون الخلفية
                  </label>
                  <input
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 h-10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    لون النص
                  </label>
                  <input
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 h-10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {loading ? 'جاري الحفظ...' : editingOffer ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
