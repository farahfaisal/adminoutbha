import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import { parcelOrdersApi } from '../../lib/parcelOrdersApi';
import { supabase } from '../../lib/supabase';
import { playNotificationBeep } from '../../utils/notificationSound';
import {
  ArchiveBoxIcon,
  TruckIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  FunnelIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  CreditCardIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const statusOptions = [
  { key: 'all', label: 'جميع الطلبات', color: 'bg-gray-100 text-gray-800' },
  { key: 'pending_review', label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800' },
  { key: 'pending', label: 'معلق', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'accepted', label: 'مقبول', color: 'bg-blue-100 text-blue-800' },
  { key: 'picked_up', label: 'تم الاستلام', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'in_transit', label: 'قيد التوصيل', color: 'bg-purple-100 text-purple-800' },
  { key: 'delivered', label: 'تم التوصيل', color: 'bg-green-100 text-green-800' },
  { key: 'cancelled', label: 'ملغي', color: 'bg-red-100 text-red-800' },
  { key: 'rejected', label: 'مرفوض', color: 'bg-red-100 text-red-800' }
];

const ParcelOrders = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllOrders, setDeletingAllOrders] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [ordersInWaitingList, setOrdersInWaitingList] = useState(new Set());

  const [formData, setFormData] = useState({
    sender_name: '',
    sender_phone: '',
    sender_address: '',
    sender_city: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    receiver_city: '',
    parcel_type: 'package',
    weight: '',
    description: '',
    notes: '',
    delivery_fee: '20',
    parcel_value: '',
    payment_method: 'cash',
    service_area_id: '',
    status: 'pending'
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const filters = { status: statusFilter, search: searchTerm };
    const { data, error } = await parcelOrdersApi.getAll(filters);

    if (error) {
      toast.error('حدث خطأ في تحميل الطلبات');
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, [statusFilter, searchTerm]);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, phone, status')
      .eq('status', 'available');

    if (!error) {
      setDrivers(data || []);
    }
  };

  const fetchServiceAreas = async () => {
    const { data, error } = await supabase
      .from('service_areas')
      .select('id, name, city')
      .order('name');

    if (!error) {
      setServiceAreas(data || []);
    }
  };

  const fetchStatistics = async () => {
    const { data } = await parcelOrdersApi.getStatistics();
    if (data) {
      setStatistics(data);
    }
  };

  const fetchOrdersInWaitingList = async () => {
    const { data, error } = await supabase
      .from('driver_waiting_list')
      .select('parcel_order_id')
      .not('parcel_order_id', 'is', null);

    if (!error && data) {
      const orderIds = new Set(data.map(item => item.parcel_order_id));
      setOrdersInWaitingList(orderIds);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    fetchServiceAreas();
    fetchStatistics();
    fetchOrdersInWaitingList();
  }, [fetchOrders]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchOrders();
      fetchStatistics();
      fetchOrdersInWaitingList();
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
      .channel('parcel-orders-realtime')
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
          table: 'captain_orders'
        },
        () => handleNewOrder('captain_orders')
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parcel_orders'
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

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    const { data, error } = await parcelOrdersApi.create(formData);

    if (error) {
      toast.error('حدث خطأ في إنشاء الطلب');
      console.error(error);
    } else {
      toast.success('تم إنشاء الطلب بنجاح');
      setShowCreateModal(false);
      resetForm();
      fetchOrders();
      fetchStatistics();
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    const { error } = await parcelOrdersApi.updateStatus(orderId, newStatus);

    if (error) {
      toast.error('حدث خطأ في تحديث حالة الطلب');
    } else {
      toast.success('تم تحديث حالة الطلب بنجاح');
      fetchOrders();
      fetchStatistics();
      if (selectedOrder?.id === orderId) {
        const { data } = await parcelOrdersApi.getById(orderId);
        setSelectedOrder(data);
      }
    }
  };

  const handleAssignDriver = async (orderId, driverId) => {
    const { error } = await parcelOrdersApi.assignDriver(orderId, driverId);

    if (error) {
      toast.error('حدث خطأ في تعيين السائق');
    } else {
      toast.success('تم تعيين السائق بنجاح');
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        const { data } = await parcelOrdersApi.getById(orderId);
        setSelectedOrder(data);
      }
    }
  };

  const handleAddToWaitingList = async (orderId) => {
    const { error } = await parcelOrdersApi.addToWaitingList(orderId);

    if (error) {
      toast.error('حدث خطأ في إضافة الطلب لقائمة الانتظار');
      console.error(error);
    } else {
      toast.success('تم إضافة الطلب لقائمة انتظار السائقين بنجاح');
      fetchOrdersInWaitingList();
      fetchOrders();
    }
  };

  const handleRemoveFromWaitingList = async (orderId) => {
    const { error } = await parcelOrdersApi.removeFromWaitingList(orderId);

    if (error) {
      toast.error('حدث خطأ في إزالة الطلب من قائمة الانتظار');
      console.error(error);
    } else {
      toast.success('تم إزالة الطلب من قائمة انتظار السائقين');
      fetchOrdersInWaitingList();
      fetchOrders();
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    const { error } = await parcelOrdersApi.delete(orderToDelete.id);

    if (error) {
      toast.error('حدث خطأ في حذف الطلب');
    } else {
      toast.success('تم حذف الطلب بنجاح');
      setShowDeleteConfirm(false);
      setOrderToDelete(null);
      fetchOrders();
      fetchStatistics();
    }
  };

  const handleDeleteAllOrders = async () => {
    if (deleteAllConfirmText !== 'حذف جميع الطلبات') {
      toast.error('الرجاء كتابة "حذف جميع الطلبات" للتأكيد');
      return;
    }

    try {
      setDeletingAllOrders(true);

      // حذف جميع طلبات الشحن
      const { error: ordersError } = await supabase
        .from('parcel_orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (ordersError) throw ordersError;

      toast.success('تم حذف جميع طلبات الشحن بنجاح');
      setShowDeleteAllConfirm(false);
      setDeleteAllConfirmText('');
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('Error deleting all parcel orders:', error);
      toast.error('فشل في حذف الطلبات: ' + error.message);
    } finally {
      setDeletingAllOrders(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sender_name: '',
      sender_phone: '',
      sender_address: '',
      sender_city: '',
      receiver_name: '',
      receiver_phone: '',
      receiver_address: '',
      receiver_city: '',
      parcel_type: 'package',
      weight: '',
      description: '',
      notes: '',
      delivery_fee: '20',
      parcel_value: '',
      payment_method: 'cash',
      service_area_id: '',
      status: 'pending'
    });
  };

  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(s => s.key === status);
    return statusOption ? statusOption.color : 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const statusOption = statusOptions.find(s => s.key === status);
    return statusOption ? statusOption.label : status;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
                <ArchiveBoxIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">طلبات الطرود</h1>
                <p className="text-gray-600 mt-1">إدارة ومتابعة طلبات توصيل الطرود</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={loading || orders.length === 0}
                className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                <TrashIcon className="w-5 h-5" />
                <span className="font-semibold">حذف الكل</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="font-semibold">طلب جديد</span>
              </button>
            </div>
          </div>

          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">إجمالي الطلبات</div>
                <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-md border border-green-200">
                <div className="text-sm text-gray-600 mb-1">تم التوصيل</div>
                <div className="text-2xl font-bold text-green-600">{statistics.delivered}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-md border border-yellow-200">
                <div className="text-sm text-gray-600 mb-1">قيد التوصيل</div>
                <div className="text-2xl font-bold text-yellow-600">{statistics.in_transit}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-md border border-blue-200">
                <div className="text-sm text-gray-600 mb-1">إجمالي الإيرادات</div>
                <div className="text-2xl font-bold text-blue-600">{statistics.total_revenue.toFixed(2)} ₪</div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-700">
                <FunnelIcon className="w-5 h-5" />
                <span className="font-semibold">تصفية:</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status.key}
                    onClick={() => setStatusFilter(status.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status.key
                        ? status.color + ' ring-2 ring-offset-2 ring-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث برقم الطلب، اسم المرسل أو المستلم، رقم الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري تحميل الطلبات...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-md border border-gray-200">
            <ArchiveBoxIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg">
                      <ArchiveBoxIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{order.order_number}</h3>
                      <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    {order.status === 'pending_review' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'accepted')}
                        className="px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-semibold"
                      >
                        ✓ قبول
                      </button>
                    )}
                    {ordersInWaitingList.has(order.id) ? (
                      <button
                        onClick={() => handleRemoveFromWaitingList(order.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-semibold"
                        title="إزالة من قائمة الانتظار"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        <span>في القائمة</span>
                      </button>
                    ) : (
                      (order.status === 'accepted' || order.status === 'pending_review' || order.status === 'pending') && (
                        <button
                          onClick={() => handleAddToWaitingList(order.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-semibold"
                          title="إرسال لقائمة انتظار السائقين"
                        >
                          <TruckIcon className="w-4 h-4" />
                          <span>للسائقين</span>
                        </button>
                      )
                    )}
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetailsModal(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setOrderToDelete(order);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold">المرسل:</span>
                      <span className="text-sm">{order.sender_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <PhoneIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.sender_phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.sender_address}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold">المستلم:</span>
                      <span className="text-sm">{order.receiver_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <PhoneIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.receiver_phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.receiver_address}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-wrap">
                    {order.driver && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <TruckIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">السائق: {order.driver.name}</span>
                      </div>
                    )}
                    {order.parcel_value > 0 && (
                      <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
                        <span className="text-sm font-semibold">قيمة الطرد: {order.parcel_value} ₪</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-700">
                      <CreditCardIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold">رسوم التوصيل: {order.delivery_fee} ₪</span>
                    </div>
                  </div>
                  {order.service_area && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.service_area.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Transition appear show={showCreateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCreateModal(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
                      <ArchiveBoxIcon className="w-6 h-6 text-white" />
                    </div>
                    إنشاء طلب طرد جديد
                  </Dialog.Title>

                  <form onSubmit={handleCreateOrder} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-bold text-gray-900 text-lg border-b pb-2">معلومات المرسل</h3>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">اسم المرسل *</label>
                          <input
                            type="text"
                            required
                            value={formData.sender_name}
                            onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">هاتف المرسل *</label>
                          <input
                            type="tel"
                            required
                            value={formData.sender_phone}
                            onChange={(e) => setFormData({ ...formData, sender_phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">عنوان المرسل *</label>
                          <textarea
                            required
                            value={formData.sender_address}
                            onChange={(e) => setFormData({ ...formData, sender_address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
                          <input
                            type="text"
                            value={formData.sender_city}
                            onChange={(e) => setFormData({ ...formData, sender_city: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-gray-900 text-lg border-b pb-2">معلومات المستلم</h3>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستلم *</label>
                          <input
                            type="text"
                            required
                            value={formData.receiver_name}
                            onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">هاتف المستلم *</label>
                          <input
                            type="tel"
                            required
                            value={formData.receiver_phone}
                            onChange={(e) => setFormData({ ...formData, receiver_phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">عنوان المستلم *</label>
                          <textarea
                            required
                            value={formData.receiver_address}
                            onChange={(e) => setFormData({ ...formData, receiver_address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
                          <input
                            type="text"
                            value={formData.receiver_city}
                            onChange={(e) => setFormData({ ...formData, receiver_city: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">نوع الطرد</label>
                        <select
                          value={formData.parcel_type}
                          onChange={(e) => setFormData({ ...formData, parcel_type: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="package">طرد عادي</option>
                          <option value="document">وثائق</option>
                          <option value="food">طعام</option>
                          <option value="fragile">قابل للكسر</option>
                          <option value="other">أخرى</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">الوزن (كغ)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">قيمة الطرد (₪)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.parcel_value}
                          onChange={(e) => setFormData({ ...formData, parcel_value: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">رسوم التوصيل (ثابتة)</label>
                        <input
                          type="text"
                          readOnly
                          value="20 ₪"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">طريقة الدفع</label>
                        <select
                          value={formData.payment_method}
                          onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="cash">نقدي</option>
                          <option value="electronic">إلكتروني</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">منطقة الخدمة</label>
                        <select
                          value={formData.service_area_id}
                          onChange={(e) => setFormData({ ...formData, service_area_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">اختر منطقة الخدمة</option>
                          {serviceAreas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name} - {area.city}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">وصف الطرد</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="أدخل وصفاً تفصيلياً للطرد..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات إضافية</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="أي ملاحظات خاصة بالتوصيل..."
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          resetForm();
                        }}
                        className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md"
                      >
                        إنشاء الطلب
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={showDetailsModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDetailsModal(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  {selectedOrder && (
                    <>
                      <Dialog.Title className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
                            <ArchiveBoxIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div>{selectedOrder.order_number}</div>
                            <div className="text-sm font-normal text-gray-600">{formatDate(selectedOrder.created_at)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowDetailsModal(false)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <XMarkIcon className="w-6 h-6" />
                        </button>
                      </Dialog.Title>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">تحديث الحالة</label>
                          <select
                            value={selectedOrder.status}
                            onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            {statusOptions.filter(s => s.key !== 'all').map((status) => (
                              <option key={status.key} value={status.key}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">تعيين سائق</label>
                          <select
                            value={selectedOrder.driver_id || ''}
                            onChange={(e) => handleAssignDriver(selectedOrder.id, e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">اختر سائق</option>
                            {drivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name} - {driver.phone}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-bold text-gray-900 mb-3">معلومات المرسل</h3>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-semibold">الاسم:</span> {selectedOrder.sender_name}</div>
                              <div><span className="font-semibold">الهاتف:</span> {selectedOrder.sender_phone}</div>
                              <div><span className="font-semibold">العنوان:</span> {selectedOrder.sender_address}</div>
                              {selectedOrder.sender_city && (
                                <div><span className="font-semibold">المدينة:</span> {selectedOrder.sender_city}</div>
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-bold text-gray-900 mb-3">معلومات المستلم</h3>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-semibold">الاسم:</span> {selectedOrder.receiver_name}</div>
                              <div><span className="font-semibold">الهاتف:</span> {selectedOrder.receiver_phone}</div>
                              <div><span className="font-semibold">العنوان:</span> {selectedOrder.receiver_address}</div>
                              {selectedOrder.receiver_city && (
                                <div><span className="font-semibold">المدينة:</span> {selectedOrder.receiver_city}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-4">
                          <h3 className="font-bold text-gray-900 mb-3">تفاصيل الطرد</h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="font-semibold">النوع:</span> {selectedOrder.parcel_type}</div>
                            <div><span className="font-semibold">الوزن:</span> {selectedOrder.weight ? `${selectedOrder.weight} كغ` : '-'}</div>
                            <div><span className="font-semibold">قيمة الطرد:</span> {selectedOrder.parcel_value ? `${selectedOrder.parcel_value} ₪` : '-'}</div>
                            <div><span className="font-semibold">رسوم التوصيل:</span> {selectedOrder.delivery_fee} ₪</div>
                            <div><span className="font-semibold">طريقة الدفع:</span> {selectedOrder.payment_method === 'cash' ? 'نقدي' : 'إلكتروني'}</div>
                          </div>
                          {selectedOrder.description && (
                            <div className="mt-3"><span className="font-semibold">الوصف:</span> {selectedOrder.description}</div>
                          )}
                          {selectedOrder.notes && (
                            <div className="mt-2"><span className="font-semibold">ملاحظات:</span> {selectedOrder.notes}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t flex justify-end">
                        <button
                          onClick={() => setShowDetailsModal(false)}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          إغلاق
                        </button>
                      </div>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteConfirm(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-bold text-gray-900 mb-4">تأكيد الحذف</Dialog.Title>
                  <p className="text-gray-600 mb-6">
                    هل أنت متأكد من حذف الطلب <span className="font-bold">{orderToDelete?.order_number}</span>؟
                    لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleDeleteOrder}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      حذف
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
                    تحذير: حذف جميع طلبات الشحن
                  </Dialog.Title>

                  <div className="mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-red-800 font-semibold mb-2">
                        هذا الإجراء خطير ولا يمكن التراجع عنه!
                      </p>
                      <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>سيتم حذف جميع طلبات الشحن ({orders.length} طلب)</li>
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
};

export default ParcelOrders;
