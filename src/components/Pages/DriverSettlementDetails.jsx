import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Calendar, DollarSign, Truck, ArrowLeft, Save, CheckCircle, Package } from 'lucide-react';

export default function DriverSettlementDetails() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showCreateSettlement, setShowCreateSettlement] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    settlement_notes: '',
    payment_method: 'cash'
  });

  useEffect(() => {
    fetchDriverData();
    fetchSettlements();
  }, [driverId]);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      calculateStats();
    }
  }, [dateRange]);

  const fetchDriverData = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single();

      if (error) throw error;
      setDriver(data);
    } catch (error) {
      console.error('Error fetching driver:', error);
      toast.error('فشل في تحميل بيانات السائق');
    }
  };

  const fetchSettlements = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_settlements')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettlements(data || []);
    } catch (error) {
      console.error('Error fetching settlements:', error);
    }
  };

  const calculateStats = async () => {
    try {
      setLoading(true);

      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, order_number, delivery_fee, status, payment_method, created_at, total, address')
        .eq('driver_id', driverId)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(ordersData || []);

      const totalDeliveryFees = ordersData.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0);
      const totalTrips = ordersData.length;
      const commissionRate = parseFloat(driver?.commission_rate || 10);
      const storeCommission = (totalDeliveryFees * commissionRate) / 100;
      const driverEarnings = totalDeliveryFees - storeCommission;

      const cashOrders = ordersData.filter(o => o.payment_method === 'cash');
      const electronicOrders = ordersData.filter(o => o.payment_method !== 'cash');

      setStats({
        totalDeliveryFees,
        totalTrips,
        commissionRate,
        storeCommission,
        driverEarnings,
        cashTrips: cashOrders.length,
        cashFees: cashOrders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0),
        electronicTrips: electronicOrders.length,
        electronicFees: electronicOrders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0)
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
      toast.error('فشل في حساب الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSettlement = async () => {
    if (!stats) {
      toast.error('الرجاء اختيار فترة زمنية صحيحة');
      return;
    }

    try {
      const { error } = await supabase
        .from('driver_settlements')
        .insert({
          driver_id: driverId,
          period_start: `${dateRange.start}T00:00:00`,
          period_end: `${dateRange.end}T23:59:59`,
          total_delivery_fees: stats.totalDeliveryFees,
          store_commission: stats.storeCommission,
          driver_earnings: stats.driverEarnings,
          total_trips: stats.totalTrips,
          commission_rate: stats.commissionRate,
          is_settled: false,
          settlement_notes: settlementForm.settlement_notes,
          payment_method: settlementForm.payment_method
        });

      if (error) throw error;

      toast.success('تم إنشاء سجل التسوية بنجاح');
      setShowCreateSettlement(false);
      fetchSettlements();
      setSettlementForm({ settlement_notes: '', payment_method: 'cash' });
    } catch (error) {
      console.error('Error creating settlement:', error);
      toast.error('فشل في إنشاء سجل التسوية');
    }
  };

  const handleMarkAsSettled = async (settlementId) => {
    try {
      const { error } = await supabase
        .from('driver_settlements')
        .update({
          is_settled: true,
          settlement_date: new Date().toISOString()
        })
        .eq('id', settlementId);

      if (error) throw error;

      toast.success('تم تحديد السجل كمسوى');
      fetchSettlements();
    } catch (error) {
      console.error('Error marking as settled:', error);
      toast.error('فشل في تحديث حالة التسوية');
    }
  };

  const handleQuickSettlement = async () => {
    if (!stats) {
      toast.error('الرجاء اختيار فترة زمنية صحيحة');
      return;
    }

    if (stats.totalTrips === 0) {
      toast.error('لا توجد رحلات في الفترة المحددة');
      return;
    }

    try {
      const { error } = await supabase
        .from('driver_settlements')
        .insert({
          driver_id: driverId,
          period_start: `${dateRange.start}T00:00:00`,
          period_end: `${dateRange.end}T23:59:59`,
          total_delivery_fees: stats.totalDeliveryFees,
          store_commission: stats.storeCommission,
          driver_earnings: stats.driverEarnings,
          total_trips: stats.totalTrips,
          commission_rate: stats.commissionRate,
          is_settled: true,
          settlement_date: new Date().toISOString(),
          payment_method: 'cash',
          settlement_notes: 'تسوية سريعة'
        });

      if (error) throw error;

      toast.success(`تم إنهاء الحساب بنجاح! المبلغ المستحق: ₪${stats.driverEarnings.toFixed(2)}`);
      fetchSettlements();
      setOrders([]);
      setStats(null);
    } catch (error) {
      console.error('Error creating quick settlement:', error);
      toast.error('فشل في إنشاء التسوية');
    }
  };

  if (loading && !driver) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin-dashboard/driver-statistics')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          العودة إلى الإحصائيات
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          تسوية حساب: {driver?.name}
        </h1>
        <p className="text-gray-600 mt-2">
          نسبة العمولة: <span className="font-semibold">{driver?.commission_rate || 10}%</span>
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">اختيار الفترة الزمنية</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">من تاريخ</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">إلى تاريخ</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={calculateStats}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'جاري الحساب...' : 'حساب الإحصائيات'}
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">إجمالي رسوم التوصيل</h3>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold">₪{stats.totalDeliveryFees.toFixed(2)}</p>
              <p className="text-sm opacity-80 mt-1">{stats.totalTrips} رحلة</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">أرباح السائق</h3>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold">₪{stats.driverEarnings.toFixed(2)}</p>
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

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">طرق الدفع</h3>
                <Truck className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-lg font-bold">نقدي: ₪{stats.cashFees.toFixed(2)}</p>
              <p className="text-sm opacity-80">إلكتروني: ₪{stats.electronicFees.toFixed(2)}</p>
            </div>
          </div>

          {stats && stats.totalTrips > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500 rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">هل تريد إنهاء حساب اليوم وتسليم النسبة؟</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">عدد الرحلات:</span>
                      <span className="font-bold text-gray-900">{stats.totalTrips} رحلة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">إجمالي رسوم التوصيل:</span>
                      <span className="font-bold text-blue-600">₪{stats.totalDeliveryFees.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">عمولة المتجر ({stats.commissionRate}%):</span>
                      <span className="font-bold text-orange-600">-₪{stats.storeCommission.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white rounded-lg border-2 border-green-600">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">المبلغ المستحق للسائق:</span>
                      <span className="text-3xl font-bold text-green-600">₪{stats.driverEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="mr-6">
                  <button
                    onClick={handleQuickSettlement}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <CheckCircle className="w-6 h-6" />
                    <div className="text-right">
                      <div className="text-lg font-bold">إنهاء الحساب</div>
                      <div className="text-sm opacity-90">وتسليم النسبة</div>
                    </div>
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-4">سيتم إنشاء سجل تسوية تلقائياً وتحديده كمسوى (مدفوع) مباشرة</p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center gap-2">
                <Package className="w-6 h-6" />
                <h2 className="text-xl font-bold">الطلبات اليومية ({orders.length} طلب)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الطلب</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الطلب</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رسوم التوصيل</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العمولة ({stats.commissionRate}%)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">صافي السائق</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => {
                      const deliveryFee = parseFloat(order.delivery_fee || 0);
                      const commission = (deliveryFee * stats.commissionRate) / 100;
                      const netAmount = deliveryFee - commission;

                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {order.order_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{new Date(order.created_at).toLocaleDateString('ar')}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ₪{parseFloat(order.total || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                            ₪{deliveryFee.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                            -₪{commission.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                            ₪{netAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.payment_method === 'cash'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {order.payment_method === 'cash' ? 'نقدي' : 'إلكتروني'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-right text-sm text-gray-900">
                        المجموع الكلي:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        ₪{stats.totalDeliveryFees.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        -₪{stats.storeCommission.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        ₪{stats.driverEarnings.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

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
              <div className="border-t pt-4 mt-4">
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
                <button
                  onClick={handleCreateSettlement}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  حفظ سجل التسوية
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">سجلات التسوية السابقة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الفترة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رسوم التوصيل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عمولة المتجر</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">أرباح السائق</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الرحلات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {settlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>{new Date(settlement.period_start).toLocaleDateString('ar')}</div>
                    <div className="text-gray-500">إلى</div>
                    <div>{new Date(settlement.period_end).toLocaleDateString('ar')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                    ₪{parseFloat(settlement.total_delivery_fees).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                    ₪{parseFloat(settlement.store_commission).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                    ₪{parseFloat(settlement.driver_earnings).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {settlement.total_trips}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {settlement.payment_method === 'cash' ? 'نقدي' :
                     settlement.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'شيك'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {settlement.is_settled ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        تم التسوية
                      </span>
                    ) : (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        معلق
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {!settlement.is_settled && (
                      <button
                        onClick={() => handleMarkAsSettled(settlement.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        تأكيد الدفع
                      </button>
                    )}
                    {settlement.is_settled && settlement.settlement_date && (
                      <div className="text-xs text-gray-500">
                        {new Date(settlement.settlement_date).toLocaleDateString('ar')}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {settlements.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">لا توجد سجلات تسوية</p>
          </div>
        )}
      </div>
    </div>
  );
}
