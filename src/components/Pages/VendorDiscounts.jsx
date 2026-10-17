import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { PlusIcon, PencilIcon, TrashIcon, TagIcon } from '@heroicons/react/24/outline';

const EMPTY_FORM = {
  vendor_id: '',
  name: '',
  discount_type: 'percentage',
  discount_percentage: '',
  discount_amount: '',
  min_order_amount: '0',
  max_discount_amount: '',
  is_active: true
};

function DiscountBadge({ discount }) {
  if (discount.discount_type === 'fixed') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold">
        ₪{parseFloat(discount.discount_amount).toFixed(2)} ثابت
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
      {discount.discount_percentage}%
    </span>
  );
}

export default function VendorDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [discountsRes, vendorsRes] = await Promise.all([
      supabase
        .from('vendor_discounts')
        .select('*, vendors(store_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('vendors')
        .select('id, store_name')
        .order('store_name')
    ]);

    if (discountsRes.error) toast.error('فشل في تحميل الخصومات');
    else setDiscounts(discountsRes.data || []);

    if (!vendorsRes.error) setVendors(vendorsRes.data || []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingDiscount(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      vendor_id: discount.vendor_id,
      name: discount.name,
      discount_type: discount.discount_type || 'percentage',
      discount_percentage: discount.discount_percentage ?? '',
      discount_amount: discount.discount_amount ?? '',
      min_order_amount: discount.min_order_amount,
      max_discount_amount: discount.max_discount_amount ?? '',
      is_active: discount.is_active
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDiscount(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const isFixed = formData.discount_type === 'fixed';
    const payload = {
      vendor_id: formData.vendor_id,
      name: formData.name.trim(),
      discount_type: formData.discount_type,
      discount_percentage: isFixed ? 0 : parseFloat(formData.discount_percentage || 0),
      discount_amount: isFixed ? parseFloat(formData.discount_amount || 0) : 0,
      min_order_amount: parseFloat(formData.min_order_amount || 0),
      max_discount_amount: formData.max_discount_amount !== '' ? parseFloat(formData.max_discount_amount) : null,
      is_active: formData.is_active,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingDiscount) {
      ({ error } = await supabase.from('vendor_discounts').update(payload).eq('id', editingDiscount.id));
    } else {
      ({ error } = await supabase.from('vendor_discounts').insert(payload));
    }

    setSaving(false);
    if (error) { toast.error(`فشل في حفظ الخصم: ${error.message}`); return; }

    toast.success(editingDiscount ? 'تم تحديث الخصم بنجاح' : 'تم إضافة الخصم بنجاح');
    closeModal();
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخصم؟')) return;
    const { error } = await supabase.from('vendor_discounts').delete().eq('id', id);
    if (error) toast.error('فشل في حذف الخصم');
    else {
      toast.success('تم حذف الخصم بنجاح');
      setDiscounts(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleToggleActive = async (discount) => {
    const { error } = await supabase
      .from('vendor_discounts')
      .update({ is_active: !discount.is_active, updated_at: new Date().toISOString() })
      .eq('id', discount.id);
    if (error) toast.error('فشل في تغيير حالة الخصم');
    else setDiscounts(prev => prev.map(d => d.id === discount.id ? { ...d, is_active: !d.is_active } : d));
  };

  const filtered = discounts.filter(d => {
    const vendorName = d.vendors?.store_name || '';
    const matchSearch = !searchTerm ||
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchVendor = !filterVendor || d.vendor_id === filterVendor;
    const matchStatus = filterStatus === '' ? true : filterStatus === 'active' ? d.is_active : !d.is_active;
    return matchSearch && matchVendor && matchStatus;
  });

  const stats = {
    total: discounts.length,
    active: discounts.filter(d => d.is_active).length,
    inactive: discounts.filter(d => !d.is_active).length,
    percentage: discounts.filter(d => d.discount_type !== 'fixed').length,
    fixed: discounts.filter(d => d.discount_type === 'fixed').length
  };

  const isFixed = formData.discount_type === 'fixed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">خصومات البائعين</h2>
          <p className="text-sm text-gray-500 mt-1">إدارة الخصومات المطبقة على متاجر البائعين</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          إضافة خصم جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-xs text-gray-500 mb-1">إجمالي الخصومات</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-xs text-gray-500 mb-1">خصومات نشطة</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-xs text-gray-500 mb-1">خصم نسبة %</p>
          <p className="text-2xl font-bold text-blue-600">{stats.percentage}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-xs text-gray-500 mb-1">خصم ثابت ₪</p>
          <p className="text-2xl font-bold text-orange-600">{stats.fixed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="بحث باسم الخصم أو المتجر..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterVendor}
          onChange={e => setFilterVendor(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">جميع المتاجر</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.store_name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">معطل</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <TagIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">لا توجد خصومات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم الخصم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع الخصم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">قيمة الخصم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحد الأدنى للطلب</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">حد أقصى للخصم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(discount => (
                  <tr key={discount.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {discount.vendors?.store_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{discount.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {discount.discount_type === 'fixed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">خصم ثابت</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">خصم نسبة</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <DiscountBadge discount={discount} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {parseFloat(discount.min_order_amount) > 0
                        ? `₪${parseFloat(discount.min_order_amount).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {discount.max_discount_amount != null ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold">
                          ₪{parseFloat(discount.max_discount_amount).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">بلا حد</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(discount)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            discount.is_active ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            discount.is_active ? 'translate-x-1' : 'translate-x-6'
                          }`} />
                        </button>
                        <span className={`text-xs font-medium ${discount.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                          {discount.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(discount)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(discount.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onClose={closeModal} className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <div className="relative bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
            <Dialog.Title className="text-xl font-bold mb-6">
              {editingDiscount ? 'تعديل الخصم' : 'إضافة خصم جديد'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* المتجر */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المتجر</label>
                <select
                  value={formData.vendor_id}
                  onChange={e => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">اختر المتجر...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.store_name}</option>
                  ))}
                </select>
              </div>

              {/* اسم الخصم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخصم</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: خصم رمضان"
                  required
                />
              </div>

              {/* نوع الخصم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع الخصم</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'percentage', discount_amount: '' })}
                    className={`py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.discount_type === 'percentage'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    خصم نسبة %
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'fixed', discount_percentage: '' })}
                    className={`py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.discount_type === 'fixed'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    خصم ثابت ₪
                  </button>
                </div>
              </div>

              {/* قيمة الخصم */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isFixed ? 'مبلغ الخصم (₪)' : 'نسبة الخصم (%)'}
                  </label>
                  {isFixed ? (
                    <input
                      type="number"
                      value={formData.discount_amount}
                      onChange={e => setFormData({ ...formData, discount_amount: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      min="0.01"
                      step="0.01"
                      placeholder="5.00"
                      required
                    />
                  ) : (
                    <input
                      type="number"
                      value={formData.discount_percentage}
                      onChange={e => setFormData({ ...formData, discount_percentage: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                      step="0.5"
                      placeholder="10"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للطلب (₪)</label>
                  <input
                    type="number"
                    value={formData.min_order_amount}
                    onChange={e => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* الحد الأقصى للخصم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الحد الأقصى لقيمة الخصم (₪)
                  <span className="mr-1 text-xs text-gray-400 font-normal">— اتركه فارغاً لعدم التقييد</span>
                </label>
                <input
                  type="number"
                  value={formData.max_discount_amount}
                  onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                  min="0.01"
                  step="0.01"
                  placeholder="مثال: 100 ₪ كحد أقصى للخصم"
                />
                {formData.max_discount_amount !== '' && parseFloat(formData.max_discount_amount) > 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    الخصم لن يتجاوز ₪{parseFloat(formData.max_discount_amount).toFixed(2)} مهما كانت قيمة الطلب
                  </p>
                )}
              </div>

              {/* الحالة */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    formData.is_active ? 'translate-x-1' : 'translate-x-6'
                  }`} />
                </button>
                <span className="text-sm text-gray-700">
                  {formData.is_active ? 'الخصم نشط' : 'الخصم معطل'}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 text-white rounded-lg disabled:opacity-60 font-medium transition-colors ${
                    isFixed ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving ? 'جاري الحفظ...' : (editingDiscount ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
