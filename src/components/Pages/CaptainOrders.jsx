import React, { useState, useEffect, Fragment } from 'react';
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import {
  TruckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  BuildingStorefrontIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import {
  getCaptainOrders,
  updateCaptainOrderStatus,
  assignDriverToCaptainOrder,
  getCaptainOrderStatistics,
  addCaptainOrderToWaitingList,
  removeCaptainOrderFromWaitingList
} from '../../lib/captainOrdersApi';
import { supabase } from '../../lib/supabase';
import { playNotificationBeep } from '../../utils/notificationSound';

const statusOptions = [
  { value: '', label: 'جميع الحالات' },
  { value: 'pending_review', label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800' },
  { value: 'pending', label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'accepted', label: 'تم القبول', color: 'bg-blue-100 text-blue-800' },
  { value: 'picked_up', label: 'تم الاستلام', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', label: 'تم التوصيل', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'ملغي', color: 'bg-red-100 text-red-800' }
];

const StatusBadge = ({ status }) => {
  const statusConfig = statusOptions.find(s => s.value === status);
  if (!statusConfig || !statusConfig.value) return null;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
      {statusConfig.label}
    </span>
  );
};

export default function CaptainOrders() {
  const [orders, setOrders] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllOrders, setDeletingAllOrders] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [ordersInWaitingList, setOrdersInWaitingList] = useState(new Set());
  const [showAssignDriverModal, setShowAssignDriverModal] = useState(false);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchStatistics();
    fetchDrivers();
    fetchWaitingList();
  }, [filters]);

  useEffect(() => {
    fetchWaitingList();
  }, [orders]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchOrders();
      fetchStatistics();
    }, 10000);

    const handleNewOrder = (orderType) => {
      playNotificationBeep(1.0, 3);

      const orderTypeLabels = {
        'orders': 'طلب عادي جديد وارد',
        'captain_orders': 'طلب كابتن جديد وارد',
        'parcel_orders': 'طلب طرد جديد وارد'
      };

      toast.success(orderTypeLabels[orderType] || 'طلب جديد وارد!', {
        position: 'top-center',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold',
        bodyClassName: 'text-lg',
        icon: '🔔',
      });

      fetchOrders();
      fetchStatistics();
    };

    const channel = supabase
      .channel('captain-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'captain_orders'
        },
        () => handleNewOrder('captain_orders')
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        () => handleNewOrder('orders')
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'parcel_orders'
        },
        () => handleNewOrder('parcel_orders')
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captain_orders'
        },
        () => {
          fetchOrders();
          fetchStatistics();
        }
      )
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getCaptainOrders(filters);
      setOrders(data);
    } catch (error) {
      console.error('Error fetching captain orders:', error);
      toast.error('فشل في تحميل طلبات الكابتن');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await getCaptainOrderStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, vehicle_type, vehicle_plate, available')
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const fetchWaitingList = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_waiting_list')
        .select('captain_order_id')
        .not('captain_order_id', 'is', null);

      if (error) throw error;

      const orderIds = new Set((data || []).map(item => item.captain_order_id));
      setOrdersInWaitingList(orderIds);
    } catch (error) {
      console.error('Error fetching waiting list:', error);
    }
  };

  const handleAddToWaitingList = async (orderId) => {
    try {
      const { error } = await addCaptainOrderToWaitingList(orderId);

      if (error) {
        toast.error('فشل في إضافة الطلب لقائمة السائقين');
        return;
      }

      toast.success('تم إضافة الطلب لقائمة انتظار السائقين');
      fetchWaitingList();
    } catch (error) {
      console.error('Error adding to waiting list:', error);
      toast.error('فشل في إضافة الطلب لقائمة السائقين');
    }
  };

  const handleRemoveFromWaitingList = async (orderId) => {
    try {
      const { error } = await removeCaptainOrderFromWaitingList(orderId);

      if (error) {
        toast.error('فشل في إزالة الطلب من قائمة السائقين');
        return;
      }

      toast.success('تم إزالة الطلب من قائمة السائقين');
      fetchWaitingList();
    } catch (error) {
      console.error('Error removing from waiting list:', error);
      toast.error('فشل في إزالة الطلب من قائمة السائقين');
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriverId || !selectedOrderForDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }

    try {
      await assignDriverToCaptainOrder(selectedOrderForDriver.id, selectedDriverId);
      toast.success('تم تعيين السائق بنجاح');
      setShowAssignDriverModal(false);
      setSelectedDriverId('');
      setSelectedOrderForDriver(null);
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('فشل في تعيين السائق');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const timestamps = {};

      if (newStatus === 'accepted') {
        timestamps.accepted_at = new Date().toISOString();
      } else if (newStatus === 'picked_up') {
        timestamps.picked_up_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        timestamps.delivered_at = new Date().toISOString();
      }

      await updateCaptainOrderStatus(orderId, newStatus, timestamps);
      toast.success('تم تحديث حالة الطلب بنجاح');
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('فشل في تحديث حالة الطلب');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDeleteAllOrders = async () => {
    if (deleteAllConfirmText !== 'حذف جميع الطلبات') {
      toast.error('الرجاء كتابة "حذف جميع الطلبات" للتأكيد');
      return;
    }

    try {
      setDeletingAllOrders(true);

      // حذف جميع طلبات الكابتن
      const { error: ordersError } = await supabase
        .from('captain_orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (ordersError) throw ordersError;

      toast.success('تم حذف جميع طلبات الكابتن بنجاح');
      setShowDeleteAllConfirm(false);
      setDeleteAllConfirmText('');
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('Error deleting all captain orders:', error);
      toast.error('فشل في حذف الطلبات: ' + error.message);
    } finally {
      setDeletingAllOrders(false);
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount) => {
    return `${parseFloat(amount || 0).toFixed(2)} ₪`;
  };

  const calculateItemTotal = (item) => {
    const quantity = parseInt(item.quantity || 1);
    // سعر المنتج × الكمية
    const baseTotal = parseFloat(item.price || 0) * quantity;

    // حساب مجموع أسعار الإضافات (مرة واحدة فقط)
    const addonsTotal = (item.addons || []).reduce((sum, addon) => {
      return sum + parseFloat(addon.price || 0);
    }, 0);

    return baseTotal + addonsTotal;
  };

  const calculateAddonsTotal = (addons) => {
    // مجموع أسعار الإضافات (مرة واحدة فقط)
    return (addons || []).reduce((sum, addon) => {
      return sum + parseFloat(addon.price || 0);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-blue-600" />
            طلبات الكابتن
          </h1>
          <p className="text-gray-600 mt-1">إدارة طلبات توصيل الكابتن</p>
        </div>
        <button
          onClick={() => setShowDeleteAllConfirm(true)}
          disabled={loading || orders.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          حذف جميع الطلبات
        </button>
      </div>

      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">إجمالي الطلبات</p>
                <p className="text-3xl font-bold mt-2">{statistics.total}</p>
              </div>
              <div className="bg-blue-400 bg-opacity-30 p-3 rounded-lg">
                <TruckIcon className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">قيد الانتظار</p>
                <p className="text-3xl font-bold mt-2">{statistics.pending}</p>
              </div>
              <div className="bg-yellow-400 bg-opacity-30 p-3 rounded-lg">
                <ClockIcon className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">تم التوصيل</p>
                <p className="text-3xl font-bold mt-2">{statistics.delivered}</p>
              </div>
              <div className="bg-green-400 bg-opacity-30 p-3 rounded-lg">
                <CheckCircleIcon className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">إجمالي رسوم التوصيل</p>
                <p className="text-2xl font-bold mt-2">{formatCurrency(statistics.totalDeliveryFees)}</p>
              </div>
              <div className="bg-purple-400 bg-opacity-30 p-3 rounded-lg">
                <BanknotesIcon className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="البحث برقم الطلب أو اسم العميل أو رقم الهاتف..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <FunnelIcon className="w-5 h-5" />
              فلترة
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حالة الطلب
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <TruckIcon className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">لا توجد طلبات</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    رقم الطلب
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    العميل
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    البائع
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    عنوان الاستلام
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    عنوان التوصيل
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    رسوم التوصيل
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    الحالة والإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {order.order_number || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{order.customer_name}</div>
                        <div className="text-gray-500">{order.customer_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {order.vendor?.store_name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        {order.vendor?.address || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {order.delivery_address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.delivery_fee)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={order.status} />
                        <div className="flex items-center gap-1 flex-wrap">
                          {order.status === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(order.id, 'accepted')}
                                className="px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs font-semibold"
                              >
                                ✓ قبول
                              </button>
                              <button
                                onClick={() => handleStatusChange(order.id, 'cancelled')}
                                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs font-semibold"
                              >
                                ✗ رفض
                              </button>
                            </>
                          )}
                          {!order.driver_id && order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForDriver(order);
                                setShowAssignDriverModal(true);
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-semibold"
                            >
                              تعيين سائق
                            </button>
                          )}
                          {ordersInWaitingList.has(order.id) ? (
                            <button
                              onClick={() => handleRemoveFromWaitingList(order.id)}
                              className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-xs font-semibold"
                            >
                              في القائمة
                            </button>
                          ) : (
                            (order.status === 'accepted' || order.status === 'pending_review' || order.status === 'pending') && (
                              <button
                                onClick={() => handleAddToWaitingList(order.id)}
                                className="px-2 py-1 bg-cyan-500 text-white rounded hover:bg-cyan-600 text-xs font-semibold"
                              >
                                للسائقين
                              </button>
                            )
                          )}
                          <button
                            onClick={() => viewOrderDetails(order)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                          >
                            تفاصيل
                          </button>
                        </div>
                        {order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs w-full"
                          >
                            {statusOptions.filter(s => s.value).map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">تفاصيل الطلب</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">معلومات الطلب</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">رقم الطلب:</span>
                        <span className="font-medium">{selectedOrder.order_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">الحالة:</span>
                        <StatusBadge status={selectedOrder.status} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">رسوم التوصيل:</span>
                        <span className="font-medium">{formatCurrency(selectedOrder.delivery_fee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">طريقة الدفع:</span>
                        <span className="font-medium">{selectedOrder.payment_method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">تاريخ الإنشاء:</span>
                        <span className="font-medium text-sm">{formatDate(selectedOrder.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      معلومات العميل
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">الاسم:</span>
                        <span className="font-medium">{selectedOrder.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">الهاتف:</span>
                        <span className="font-medium">{selectedOrder.customer_phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                      <BuildingStorefrontIcon className="w-4 h-4" />
                      معلومات البائع
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">اسم المتجر:</span>
                        <span className="font-medium">{selectedOrder.vendor?.store_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">الهاتف:</span>
                        <span className="font-medium">{selectedOrder.vendor?.phone || '-'}</span>
                      </div>
                      {selectedOrder.vendor?.address && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="text-gray-600 text-xs mb-1">عنوان المتجر:</div>
                          <div className="font-medium text-sm">{selectedOrder.vendor.address}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedOrder.driver && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                        <TruckIcon className="w-4 h-4" />
                        معلومات السائق
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">الاسم:</span>
                          <span className="font-medium">{selectedOrder.driver.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">الهاتف:</span>
                          <span className="font-medium">{selectedOrder.driver.phone}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4" />
                  العناوين
                </h4>
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <BuildingStorefrontIcon className="w-4 h-4 text-blue-600" />
                      <div className="text-sm text-blue-700 font-bold">عنوان الاستلام (المتجر)</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedOrder.vendor?.address || '-'}
                    </div>
                    {selectedOrder.vendor?.store_name && (
                      <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                        <BuildingStorefrontIcon className="w-3 h-3" />
                        {selectedOrder.vendor.store_name}
                      </div>
                    )}
                    {selectedOrder.vendor?.phone && (
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                        <PhoneIcon className="w-3 h-3" />
                        {selectedOrder.vendor.phone}
                      </div>
                    )}
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPinIcon className="w-4 h-4 text-green-600" />
                      <div className="text-sm text-green-700 font-bold">عنوان التوصيل (العميل)</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{selectedOrder.delivery_address}</div>
                    {selectedOrder.city && (
                      <div className="text-xs text-gray-600 mt-1">{selectedOrder.city}</div>
                    )}
                    {selectedOrder.customer_name && (
                      <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {selectedOrder.customer_name}
                      </div>
                    )}
                    {selectedOrder.customer_phone && (
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                        <PhoneIcon className="w-3 h-3" />
                        {selectedOrder.customer_phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.items_data && selectedOrder.items_data.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">المنتجات</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {selectedOrder.items_data.map((item, index) => (
                      <div key={index} className="border-b border-gray-200 pb-3 last:border-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div>سعر المنتج: {item.quantity} × {formatCurrency(item.price)} = {formatCurrency(parseFloat(item.price) * parseInt(item.quantity))}</div>
                              {item.addons && item.addons.length > 0 && (
                                <div className="text-amber-600">+ إضافات: {formatCurrency(calculateAddonsTotal(item.addons))}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(calculateItemTotal(item))}
                          </div>
                        </div>
                        {item.addons && item.addons.length > 0 && (
                          <div className="mr-4 space-y-1">
                            <div className="text-xs font-semibold text-gray-600 mb-1">الإضافات:</div>
                            {item.addons.map((addon, addonIndex) => (
                              <div key={addonIndex} className="flex justify-between items-center text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded">
                                <span>{addon.name}</span>
                                <span className="font-semibold">{formatCurrency(addon.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="border-t border-gray-300 pt-3 mt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">المجموع الفرعي:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            selectedOrder.items_data.reduce((sum, item) => sum + calculateItemTotal(item), 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">رسوم التوصيل:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(selectedOrder.delivery_fee)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-400">
                        <span className="text-base font-bold text-gray-900">الإجمالي:</span>
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(
                            selectedOrder.items_data.reduce((sum, item) => sum + calculateItemTotal(item), 0) +
                            parseFloat(selectedOrder.delivery_fee || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">ملاحظات</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعيين سائق */}
      <Transition appear show={showAssignDriverModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAssignDriverModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-right align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 flex items-center gap-2 mb-4">
                    <TruckIcon className="w-6 h-6 text-blue-600" />
                    تعيين سائق للطلب
                  </Dialog.Title>

                  {selectedOrderForDriver && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <div className="font-semibold">رقم الطلب: {selectedOrderForDriver.order_number}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          العميل: {selectedOrderForDriver.customer_name}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اختر السائق
                    </label>
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- اختر سائق --</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} - {driver.phone} ({driver.vehicle_type})
                        </option>
                      ))}
                    </select>
                    {drivers.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">لا توجد سائقين متاحين حالياً</p>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200"
                      onClick={() => {
                        setShowAssignDriverModal(false);
                        setSelectedDriverId('');
                        setSelectedOrderForDriver(null);
                      }}
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 ${
                        !selectedDriverId ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={handleAssignDriver}
                      disabled={!selectedDriverId}
                    >
                      تعيين السائق
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* نافذة تأكيد حذف جميع الطلبات */}
      <Transition appear show={showDeleteAllConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteAllConfirm(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-right align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-red-600 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    تحذير: حذف جميع طلبات الكابتن
                  </Dialog.Title>

                  <div className="mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-red-800 font-semibold mb-2">
                        هذا الإجراء خطير ولا يمكن التراجع عنه!
                      </p>
                      <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>سيتم حذف جميع طلبات الكابتن ({orders.length} طلب)</li>
                        <li>سيتم حذف سجلات الحالات المرتبطة</li>
                        <li>لن تتمكن من استعادة هذه البيانات</li>
                      </ul>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        للتأكيد، اكتب: <span className="font-bold text-red-600">حذف جميع الطلبات</span>
                      </label>
                      <input
                        type="text"
                        value={deleteAllConfirmText}
                        onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="حذف جميع الطلبات"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
                      onClick={() => {
                        setShowDeleteAllConfirm(false);
                        setDeleteAllConfirmText('');
                      }}
                      disabled={deletingAllOrders}
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 ${
                        deletingAllOrders || deleteAllConfirmText !== 'حذف جميع الطلبات' ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={handleDeleteAllOrders}
                      disabled={deletingAllOrders || deleteAllConfirmText !== 'حذف جميع الطلبات'}
                    >
                      {deletingAllOrders ? 'جاري الحذف...' : 'حذف جميع الطلبات نهائياً'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
