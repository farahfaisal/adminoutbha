import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Calendar, DollarSign, ShoppingBag, ArrowLeft, Save, CheckCircle } from 'lucide-react';

export default function VendorSettlementDetails() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showCreateSettlement, setShowCreateSettlement] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    settlement_notes: '',
    payment_method: 'cash'
  });

  // keep latest vendor ref to avoid stale closure in calculateStats
  const vendorRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      setPageLoading(true);
      await Promise.all([fetchVendorData(), fetchSettlements()]);
      setPageLoading(false);
    };
    init();
  }, [vendorId]);

  const fetchVendorData = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .maybeSingle();

    if (error) {
      toast.error('فشل في تحميل بيانات البائع');
      return;
    }
    setVendor(data);
    vendorRef.current = data;
  };

  const fetchSettlements = async () => {
    const { data, error } = await supabase
      .from('vendor_settlements')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching settlements:', error);
      return;
    }
    setSettlements(data || []);
  };

  const calculateStats = async () => {
    if (!dateRange.start || !dateRange.end) return;

    const currentVendor = vendorRef.current || vendor;
    setStatsLoading(true);
    setStats(null);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, total, subtotal, delivery_fee, status, payment_method, created_at')
      .eq('vendor_id', vendorId)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    setStatsLoading(false);

    if (error) {
      toast.error('فشل في حساب الإحصائيات');
      return;
    }

    // subtotal = سعر المنتجات فقط بدون رسوم التوصيل
    const totalSales = orders.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0);
    const totalDelivery = orders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0);
    const totalOrders = orders.length;
    const commissionRate = parseFloat(currentVendor?.commission_rate || 10);
    const storeCommission = (totalSales * commissionRate) / 100;
    const vendorEarnings = totalSales - storeCommission;

    const cashOrders = orders.filter(o => o.payment_method === 'cash');
    const electronicOrders = orders.filter(o => o.payment_method !== 'cash');

    setStats({
      totalSales,
      totalDelivery,
      totalOrders,
      commissionRate,
      storeCommission,
      vendorEarnings,
      cashSales: cashOrders.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0),
      cashOrders: cashOrders.length,
      electronicSales: electronicOrders.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0),
      electronicOrders: electronicOrders.length
    });
  };

  const handleCreateSettlement = async () => {
    if (!stats) {
      toast.error('الرجاء حساب الإحصائيات أولاً');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('vendor_settlements')
      .insert({
        vendor_id: vendorId,
        period_start: `${dateRange.start}T00:00:00`,
        period_end: `${dateRange.end}T23:59:59`,
        total_sales: stats.totalSales,
        store_commission: stats.storeCommission,
        vendor_earnings: stats.vendorEarnings,
        total_orders: stats.totalOrders,
        commission_rate: stats.commissionRate,
        is_settled: false,
        settlement_notes: settlementForm.settlement_notes || null,
        payment_method: settlementForm.payment_method
      });

    setSaving(false);

    if (error) {
      toast.error(`فشل في إنشاء سجل التسوية: ${error.message}`);
      return;
    }

    toast.success('تم إنشاء سجل التسوية بنجاح');
    setShowCreateSettlement(false);
    setSettlementForm({ settlement_notes: '', payment_method: 'cash' });
    fetchSettlements();
  };

  const handleMarkAsSettled = async (settlementId) => {
    const { error } = await supabase
      .from('vendor_settlements')
      .update({
        is_settled: true,
        settlement_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', settlementId);

    if (error) {
      toast.error('فشل في تحديث حالة التسوية');
      return;
    }

    toast.success('تم تأكيد الدفع بنجاح');
    fetchSettlements();
  };

  const paymentLabel = (method) => {
    if (method === 'cash') return 'نقدي';
    if (method === 'bank_transfer') return 'تحويل بنكي';
    if (method === 'check') return 'شيك';
    return method;
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin-dashboard/vendor-statistics')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          العودة إلى الإحصائيات
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          تسوية حساب: {vendor?.store_name}
        </h1>
        <p className="text-gray-600 mt-1">
          نسبة العمولة: <span className="font-semibold">{vendor?.commission_rate || 10}%</span>
        </p>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          اختيار الفترة الزمنية
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">من تاريخ</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">إلى تاريخ</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={calculateStats}
              disabled={statsLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {statsLoading ? 'جاري الحساب...' : 'حساب الإحصائيات'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {stats && !statsLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">إجمالي المبيعات</h3>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold">₪{stats.totalSales.toFixed(2)}</p>
              <p className="text-sm opacity-80 mt-1">{stats.totalOrders} طلب</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">أرباح البائع</h3>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold">₪{stats.vendorEarnings.toFixed(2)}</p>
              <p className="text-sm opacity-80 mt-1">بعد خصم العمولة</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">عمولة المتجر</h3>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold">₪{stats.storeCommission.toFixed(2)}</p>
              <p className="text-sm opacity-80 mt-1">{stats.commissionRate}%</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">طرق الدفع (منتجات)</h3>
                <ShoppingBag className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-base font-bold">نقدي: ₪{stats.cashSales.toFixed(2)}</p>
              <p className="text-sm opacity-90 mt-1">إلكتروني: ₪{stats.electronicSales.toFixed(2)}</p>
              <p className="text-xs opacity-70 mt-2">توصيل (غير مشمول): ₪{stats.totalDelivery.toFixed(2)}</p>
            </div>
          </div>

          {/* Create Settlement */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">إنشاء سجل تسوية</h2>
              <button
                onClick={() => setShowCreateSettlement(!showCreateSettlement)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {showCreateSettlement ? 'إلغاء' : 'إنشاء سجل تسوية'}
              </button>
            </div>

            {showCreateSettlement && (
              <div className="border-t pt-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">طريقة الدفع</label>
                    <select
                      value={settlementForm.payment_method}
                      onChange={(e) => setSettlementForm({ ...settlementForm, payment_method: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="cash">نقدي</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
                    <input
                      type="text"
                      value={settlementForm.settlement_notes}
                      onChange={(e) => setSettlementForm({ ...settlementForm, settlement_notes: e.target.value })}
                      placeholder="ملاحظات اختيارية..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Summary before saving */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">الفترة:</span> {dateRange.start} إلى {dateRange.end}</p>
                  <p><span className="font-medium">إجمالي المبيعات (منتجات فقط):</span> ₪{stats.totalSales.toFixed(2)}</p>
                  <p><span className="font-medium text-gray-500">رسوم التوصيل (غير مشمولة):</span> ₪{stats.totalDelivery.toFixed(2)}</p>
                  <p><span className="font-medium">عمولة المتجر ({stats.commissionRate}%):</span> ₪{stats.storeCommission.toFixed(2)}</p>
                  <p><span className="font-medium text-green-700">المبلغ المستحق للبائع:</span> <span className="text-green-700 font-bold">₪{stats.vendorEarnings.toFixed(2)}</span></p>
                </div>

                <button
                  onClick={handleCreateSettlement}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'جاري الحفظ...' : 'حفظ سجل التسوية'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Settlements Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">سجلات التسوية السابقة</h2>
        </div>

        {settlements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد سجلات تسوية</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الفترة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبيعات</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عمولة المتجر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">أرباح البائع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الطلبات</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <div className="font-medium">{new Date(settlement.period_start).toLocaleDateString('ar')}</div>
                      <div className="text-gray-400 text-xs">إلى</div>
                      <div className="font-medium">{new Date(settlement.period_end).toLocaleDateString('ar')}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold whitespace-nowrap">
                      ₪{parseFloat(settlement.total_sales).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-orange-600 whitespace-nowrap">
                      ₪{parseFloat(settlement.store_commission).toFixed(2)}
                      <div className="text-xs text-orange-400">{settlement.commission_rate}%</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600 whitespace-nowrap">
                      ₪{parseFloat(settlement.vendor_earnings).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-center">
                      {settlement.total_orders}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {paymentLabel(settlement.payment_method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {settlement.is_settled ? (
                        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          تم التسوية
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          معلق
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!settlement.is_settled ? (
                        <button
                          onClick={() => handleMarkAsSettled(settlement.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                        >
                          <CheckCircle className="w-4 h-4" />
                          تأكيد الدفع
                        </button>
                      ) : (
                        settlement.settlement_date && (
                          <div className="text-xs text-gray-500">
                            {new Date(settlement.settlement_date).toLocaleDateString('ar')}
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
