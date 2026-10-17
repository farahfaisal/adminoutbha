import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';

const EMPTY_FORM = {
  code: '',
  type: 'percentage',
  value: '',
  min_order_amount: '',
  max_discount: '',
  usage_limit: '',
  start_date: '',
  end_date: '',
  description: '',
  status: 'active'
};

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const initialFilters = {
    code: {
      type: 'text',
      label: 'كود الخصم',
      placeholder: 'البحث بكود الخصم',
      value: ''
    },
    type: {
      type: 'select',
      label: 'نوع الخصم',
      placeholder: 'جميع الأنواع',
      options: [
        { value: 'percentage', label: 'نسبة مئوية' },
        { value: 'fixed', label: 'مبلغ ثابت' }
      ],
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'inactive', label: 'غير نشط' },
        { value: 'expired', label: 'منتهي' }
      ],
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('فشل في تحميل الكوبونات');
    } else {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openAdd = () => {
    setEditingCoupon(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || '',
      type: coupon.type || 'percentage',
      value: coupon.value ?? '',
      min_order_amount: coupon.min_order_amount ?? '',
      max_discount: coupon.max_discount ?? '',
      usage_limit: coupon.usage_limit ?? '',
      start_date: coupon.start_date || '',
      end_date: coupon.end_date || '',
      description: coupon.description || '',
      status: coupon.status || 'active'
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      code: formData.code.trim().toUpperCase(),
      type: formData.type,
      value: parseFloat(formData.value),
      min_order_amount: formData.min_order_amount !== '' ? parseFloat(formData.min_order_amount) : null,
      max_discount: formData.max_discount !== '' ? parseFloat(formData.max_discount) : null,
      usage_limit: formData.usage_limit !== '' ? parseInt(formData.usage_limit) : null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      description: formData.description || null,
      status: formData.status
    };

    let error;
    if (editingCoupon) {
      ({ error } = await supabase
        .from('coupons')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingCoupon.id));
    } else {
      ({ error } = await supabase.from('coupons').insert(payload));
    }

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        toast.error('كود الكوبون مستخدم مسبقاً، اختر كوداً آخر');
      } else {
        toast.error(`فشل في حفظ الكوبون: ${error.message}`);
      }
      return;
    }

    toast.success(editingCoupon ? 'تم تحديث الكوبون بنجاح' : 'تم إضافة الكوبون بنجاح');
    closeModal();
    fetchCoupons();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف الكوبون');
    } else {
      toast.success('تم حذف الكوبون بنجاح');
      setCoupons(prev => prev.filter(c => c.id !== id));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'expired': return 'منتهي';
      default: return status;
    }
  };

  const filteredCoupons = filterData(coupons);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">كوبونات الخصم</h2>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          إضافة كوبون جديد
        </button>
      </div>

      <SearchFilter filters={filters} onFilterChange={handleFilterChange} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-16 text-gray-500">لا توجد كوبونات</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoupons.map(coupon => (
            <div key={coupon.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold font-mono tracking-wide">{coupon.code}</h3>
                  <p className="text-gray-500 text-sm mt-1">{coupon.description || '-'}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(coupon.status)}`}>
                  {getStatusText(coupon.status)}
                </span>
              </div>

              <div className="space-y-1.5 mb-4 text-sm text-gray-700">
                <p>
                  <span className="font-medium">نوع الخصم: </span>
                  {coupon.type === 'percentage' ? `${coupon.value}%` : `₪${coupon.value}`}
                </p>
                {coupon.min_order_amount != null && (
                  <p><span className="font-medium">الحد الأدنى للطلب: </span>₪{coupon.min_order_amount}</p>
                )}
                {coupon.max_discount != null && (
                  <p><span className="font-medium">أقصى خصم: </span>₪{coupon.max_discount}</p>
                )}
                {coupon.usage_limit != null && (
                  <p><span className="font-medium">الاستخدام: </span>{coupon.used_count ?? 0}/{coupon.usage_limit}</p>
                )}
                <p>
                  <span className="font-medium">الصلاحية: </span>
                  {new Date(coupon.start_date).toLocaleDateString('ar-SA')} -{' '}
                  {new Date(coupon.end_date).toLocaleDateString('ar-SA')}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => openEdit(coupon)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(coupon.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={showModal}
        onClose={closeModal}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-xl p-8 max-w-md w-full shadow-xl">
            <Dialog.Title className="text-xl font-bold mb-6">
              {editingCoupon ? 'تعديل كوبون' : 'إضافة كوبون جديد'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كود الخصم</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 uppercase font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="WELCOME10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع الخصم</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="percentage">نسبة مئوية %</option>
                    <option value="fixed">مبلغ ثابت ₪</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'percentage' ? 'نسبة الخصم (%)' : 'قيمة الخصم (₪)'}
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step={formData.type === 'percentage' ? '1' : '0.01'}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للطلب (₪)</label>
                  <input
                    type="number"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="اختياري"
                  />
                </div>
                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">أقصى خصم (₪)</label>
                    <input
                      type="number"
                      value={formData.max_discount}
                      onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                      placeholder="اختياري"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للاستخدام</label>
                <input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  placeholder="اختياري - لا حد"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="expired">منتهي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="وصف اختياري للكوبون"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg border hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium"
                >
                  {saving ? 'جاري الحفظ...' : (editingCoupon ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
