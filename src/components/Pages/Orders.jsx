import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import OrderProcessing from '../Orders/OrderProcessing';
import EditOrderModal from '../Orders/EditOrderModal';
import { Dialog, Transition } from '@headlessui/react';
import AddressMapModal from '../AddressMapModal';
import { playNotificationBeep } from '../../utils/notificationSound';

const FIELD_LABELS = {
  order_number: 'رقم الطلب',
  customer_name: 'اسم العميل',
  customer_city: 'المدينة',
  customer_phone: 'هاتف العميل',
  address: 'العنوان',
  vendor_name: 'اسم التاجر',
  service_area_name: 'منطقة الخدمة',
  name: 'المنتجات',
  notes: 'ملاحظات الطلب',
  total: 'المبلغ',
  delivery_fee: 'رسوم التوصيل',
  discount_info: 'الخصم',
  status: 'الحالة',
  created_at: 'تاريخ الطلب'
};

const DISPLAY_FIELDS = [
  'order_number',
  'customer_name',
  'customer_city',
  'customer_phone',
  'address',
  'vendor_name',
  'service_area_name',
  'name',
  'notes',
  'total',
  'delivery_fee',
  'discount_info',
  'created_at'
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersPerPage = 50;
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllOrders, setDeletingAllOrders] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('orders_visible_columns');
      return saved ? JSON.parse(saved) : DISPLAY_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {});
    } catch {
      return DISPLAY_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {});
    }
  });

  // تعريف حالات الطلبات مع الألوان والنصوص
  const statusFilters = [
    { key: 'all', label: 'جميع الطلبات', color: 'bg-gray-100 text-gray-800' },
    { key: 'pending_review', label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800' },
    { key: 'pending', label: 'طلبات معلقة', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'accepted', label: 'طلبات مقبولة', color: 'bg-blue-100 text-blue-800' },
    { key: 'processing', label: 'قيد التحضير', color: 'bg-orange-100 text-orange-800' },
    { key: 'waiting-for-driver', label: 'في انتظار السائق', color: 'bg-purple-100 text-purple-800' },
    { key: 'delivering', label: 'قيد التوصيل', color: 'bg-indigo-100 text-indigo-800' },
    { key: 'completed', label: 'طلبات مكتملة', color: 'bg-green-100 text-green-800' },
    { key: 'cancelled', label: 'طلبات ملغية', color: 'bg-red-100 text-red-800' },
    { key: 'rejected', label: 'طلبات مرفوضة', color: 'bg-red-100 text-red-800' }
  ];

  const getGoogleMapsLink = (address) => {
    if (!address) return null;
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const from = (currentPage - 1) * ordersPerPage;
      const to = from + ordersPerPage - 1;

      const { data, error: supabaseError, count } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:vendors(store_name),
          driver:drivers(name),
          service_area:service_areas(id, name, city)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (supabaseError) {
        throw new Error(`Database error: ${supabaseError.message}`);
      }

      let ordersWithItems = [];

      if (data && data.length > 0) {
        // Group orders by order_group_id for multi-vendor orders
        const orderGroups = {};
        const standaloneOrders = [];

        data.forEach(order => {
          if (order.is_multi_vendor && order.order_group_id) {
            if (!orderGroups[order.order_group_id]) {
              orderGroups[order.order_group_id] = [];
            }
            orderGroups[order.order_group_id].push(order);
          } else {
            standaloneOrders.push(order);
          }
        });

        // Create grouped orders - show only one parent order per group
        const groupedOrders = [];
        Object.values(orderGroups).forEach(group => {
          // Sort by vendor_order_index
          group.sort((a, b) => (a.vendor_order_index || 0) - (b.vendor_order_index || 0));

          // Use first order as the parent, others as children
          const parentOrder = group[0];
          const childOrders = group.slice(1);

          groupedOrders.push({
            ...parentOrder,
            child_orders: childOrders,
            is_grouped: true
          });
        });

        // Combine grouped and standalone orders
        const allParentOrders = [...groupedOrders, ...standaloneOrders];

        // Get all order IDs including children for fetching items
        const allOrderIds = [];
        allParentOrders.forEach(order => {
          allOrderIds.push(order.id);
          if (order.child_orders && order.child_orders.length > 0) {
            allOrderIds.push(...order.child_orders.map(c => c.id));
          }
        });
        
        // Fetch all order items in a single batch query
        const { data: allItemsData, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            id,
            order_id,
            product_id,
            quantity,
            price,
            total,
            name,
            product_name,
            variant_name,
            addons_data,
            notes,
            product:product_id(name)
          `)
          .in('order_id', allOrderIds);
        
        // Fetch latest status for each order in a single query
        const { data: statusData, error: statusError } = await supabase
          .from('order_status_history')
          .select('order_id, status, created_at')
          .in('order_id', allOrderIds)
          .order('created_at', { ascending: false });
        
        const itemsByOrderId = {};
        if (!itemsError && allItemsData) {
          allItemsData.forEach(item => {
            if (!itemsByOrderId[item.order_id]) {
              itemsByOrderId[item.order_id] = [];
            }
            itemsByOrderId[item.order_id].push(item);
          });
        } else if (itemsError) {
          console.error('Error fetching items:', itemsError);
        }
        
        // Group status by order_id and get the latest one
        const latestStatusByOrderId = {};
        if (!statusError && statusData) {
          statusData.forEach(status => {
            if (!latestStatusByOrderId[status.order_id]) {
              latestStatusByOrderId[status.order_id] = status;
            }
          });
        }
        
        // Merge items with orders
        ordersWithItems = allParentOrders.map(order => {
          const orderItems = itemsByOrderId[order.id] || [];
          const latestStatus = latestStatusByOrderId[order.id];
          const childOrders = order.child_orders || [];

          // If multi-vendor order, collect all items and vendor names from child orders
          let allItems = [...orderItems];
          let allVendorNames = [];
          let totalAmount = Number(order.total || 0);

          // Add main vendor
          if (order.vendor?.store_name) {
            allVendorNames.push(order.vendor.store_name);
          } else if (order.vendor_name) {
            allVendorNames.push(order.vendor_name);
          }

          if (order.is_multi_vendor && childOrders.length > 0) {
            childOrders.forEach(child => {
              const childItems = itemsByOrderId[child.id] || [];
              allItems.push(...childItems);
              totalAmount += Number(child.total || 0);

              if (child.vendor?.store_name) {
                allVendorNames.push(child.vendor.store_name);
              } else if (child.vendor_name) {
                allVendorNames.push(child.vendor_name);
              }
            });
          }

          const productName = allItems.length > 0 ?
            allItems.map(item => {
              const name = item.product?.name || item.product_name || item.name || 'منتج';
              return `${name} (${item.quantity})`;
            }).join(', ') :
            'غير محدد';

          return {
            ...order,
            items: allItems,
            child_orders: childOrders,
            vendor_names: allVendorNames,
            total: totalAmount,
            name: productName,
            latest_status: latestStatus?.status || order.status,
            status_updated_at: latestStatus?.created_at || order.updated_at
          };
        });
      } else {
        ordersWithItems = [];
      }

      const transformedOrders = ordersWithItems.map(order => ({
        id: order.id,
        order_number: order.order_number || '-',
        customer_name: order.customer_name || 'غير معروف',
        customer_phone: order.customer_phone || 'غير متوفر',
        address: order.address || 'غير متوفر',
        customer_city: order.address ? extractCity(order.address) : 'غير محدد',
        vendor_name: order.is_multi_vendor && order.vendor_names.length > 0
          ? `${order.vendor_names.length} متاجر: ${order.vendor_names.join(', ')}`
          : (order.vendor?.store_name || order.vendor_name || 'غير معروف'),
        service_area_name: order.service_area?.name || order.city || 'غير محدد',
        service_area: order.service_area,
        name: order.name || 'غير محدد',
        notes: order.notes || '',
        total: order.total,
        delivery_fee: order.delivery_fee || 0,
        status: order.latest_status || order.status,
        status_text: order.status_text,
        status_updated_at: order.status_updated_at,
        created_at: order.created_at,
        driver_name: order.driver_name || order.driver?.name || null,
        driver_id: order.driver_id,
        items: order.items || [],
        vendor: order.vendor,
        vendor_id: order.vendor_id,
        geocoded_latitude: order.geocoded_latitude,
        geocoded_longitude: order.geocoded_longitude,
        is_multi_vendor: order.is_multi_vendor,
        order_group_id: order.order_group_id,
        items_data: order.items_data,
        child_orders: order.child_orders || [],
        vendor_names: order.vendor_names || [],
        wallet_amount: order.wallet_amount || 0,
        coupon_discount: order.coupon_discount || 0,
        points_discount: order.points_discount || 0,
        vendor_discount_amount: order.vendor_discount_amount || 0,
        vendor_discount_percentage: order.vendor_discount_percentage || 0,
        vendor_discount_id: order.vendor_discount_id || null,
        subtotal: order.subtotal || 0,
        payment_method: order.payment_method || null
      }));

      setOrders(transformedOrders);
      setTotalOrders(count || 0);
      setLastUpdated(new Date());
    } catch (err) {
      let errorMessage = 'فشل في جلب الطلبات. ';
      errorMessage += err.message || 'حدث خطأ غير متوقع.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, ordersPerPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchOrders();
    }, 120000);

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
    };

    const channel = supabase
      .channel('all-orders-changes')
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
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
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
        }
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
        }
      )
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  function extractCity(address) {
    const cities = ['غزة', 'رفح', 'خان يونس', 'دير البلح', 'بيت لاهيا', 'بيت حانون', 'جباليا', 'رام الله', 'البيرة', 'نابلس', 'جنين', 'طولكرم', 'قلقيلية', 'أريحا', 'بيت لحم', 'الخليل', 'القدس', 'بيت جالا', 'بيت ساحور', 'طوباس', 'سلفيت'];
    for (const city of cities) {
      if (address.includes(city)) return city;
    }
    return address.split(',')[0]?.trim() || 'غير محدد';
  }

  const formatCellValue = (value, field) => {
    if (value === null || value === undefined) return 'غير متوفر';
    if (field === 'created_at') return new Date(value).toLocaleString('ar');
    if (field === 'total') return `${Number(value).toFixed(2)} شيكل`;
    if (field === 'status') {
      const statusMap = {
        'pending_review': 'قيد المراجعة',
        'pending': 'معلق',
        'accepted': 'مقبول',
        'processing': 'قيد التحضير',
        'waiting-for-driver': 'في انتظار السائق',
        'delivering': 'قيد التوصيل',
        'completed': 'مكتمل',
        'cancelled': 'ملغي',
        'rejected': 'مرفوض'
      };
      return statusMap[value] || value;
    }
    return String(value);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-orange-100 text-orange-800';
      case 'delivering': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleActionClick = (order) => {
    setSelectedOrder(order);
    setShowProcessingModal(true);
  };

  const handleStatusUpdate = async () => {
    fetchOrders();
  };

  const handleAddressClick = (order) => {
    setSelectedAddress(order);
    setShowAddressMap(true);
  };

  const handleDeleteClick = (order) => {
    setOrderToDelete(order);
    setShowDeleteConfirm(true);
  };

  const handleEditClick = (order) => {
    setOrderToEdit(order);
    setShowEditModal(true);
  };

  const handleApproveOrder = async (order) => {
    if (!window.confirm('هل تريد قبول هذا الطلب وتحويله إلى قيد التحضير؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'processing' })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('تم قبول الطلب وتحويله إلى قيد التحضير');
      fetchOrders();
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('فشل في قبول الطلب: ' + error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;

    try {
      setDeletingOrder(true);

      // Delete the order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;

      toast.success('تم حذف الطلب بنجاح');
      setShowDeleteConfirm(false);
      setOrderToDelete(null);

      // Refresh orders list
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('فشل في حذف الطلب: ' + error.message);
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleDeleteAllOrders = async () => {
    if (deleteAllConfirmText !== 'حذف جميع الطلبات') {
      toast.error('الرجاء كتابة "حذف جميع الطلبات" للتأكيد');
      return;
    }

    try {
      setDeletingAllOrders(true);

      // حذف جميع order_items أولاً
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (itemsError) throw itemsError;

      // حذف جميع الطلبات
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (ordersError) throw ordersError;

      toast.success('تم حذف جميع الطلبات بنجاح');
      setShowDeleteAllConfirm(false);
      setDeleteAllConfirmText('');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting all orders:', error);
      toast.error('فشل في حذف الطلبات: ' + error.message);
    } finally {
      setDeletingAllOrders(false);
    }
  };

  // دالة لفلترة الطلبات حسب التاريخ
  const filterByDate = (order) => {
    if (dateFilter === 'all') return true;

    const orderDate = new Date(order.created_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today':
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        return orderDate >= today && orderDate <= todayEnd;

      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return orderDate >= yesterday && orderDate < today;

      case 'last7':
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        return orderDate >= last7Days;

      case 'last30':
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        return orderDate >= last30Days;

      case 'custom':
        if (customDateFrom && customDateTo) {
          const fromDate = new Date(customDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(customDateTo);
          toDate.setHours(23, 59, 59, 999);
          return orderDate >= fromDate && orderDate <= toDate;
        } else if (customDateFrom) {
          const fromDate = new Date(customDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          return orderDate >= fromDate;
        } else if (customDateTo) {
          const toDate = new Date(customDateTo);
          toDate.setHours(23, 59, 59, 999);
          return orderDate <= toDate;
        }
        return true;

      default:
        return true;
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => statusFilter === 'all' || order.status === statusFilter)
      .filter(filterByDate)
      .filter(order => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        return (
          order.order_number?.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          order.customer_phone?.toLowerCase().includes(query) ||
          order.vendor_name?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, statusFilter, dateFilter, customDateFrom, customDateTo, searchQuery]);

  const toggleColumn = (field) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [field]: !prev[field] };
      localStorage.setItem('orders_visible_columns', JSON.stringify(updated));
      return updated;
    });
  };

  const activeFields = DISPLAY_FIELDS.filter(f => visibleColumns[f]);

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length };
    statusFilters.forEach(filter => {
      if (filter.key !== 'all') {
        counts[filter.key] = orders.filter(order => order.status === filter.key).length;
      }
    });
    return counts;
  }, [orders]);

  const getStatusCount = useCallback((status) => {
    return statusCounts[status] || 0;
  }, [statusCounts]);

  return (
    <div className="p-4 relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">قائمة الطلبات</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>تحديث تلقائي كل 10 ثوان</span>
            </div>
            <span>•</span>
            <span>آخر تحديث: {lastUpdated.toLocaleTimeString('ar')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={loading || orders.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            حذف الكل
          </button>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>
      </div>

      {/* حقل البحث وزر الأعمدة */}
      <div className="mb-4 flex gap-2 items-start">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ابحث برقم الطلب، اسم العميل، رقم الهاتف، أو اسم المتجر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* زر التحكم في الأعمدة */}
        <div className="relative">
          <button
            onClick={() => setShowColumnToggle(v => !v)}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 shadow-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            الأعمدة
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
              {activeFields.length}/{DISPLAY_FIELDS.length}
            </span>
          </button>

          {showColumnToggle && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColumnToggle(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">إظهار / إخفاء الأعمدة</p>
                <div className="space-y-1">
                  {DISPLAY_FIELDS.map(field => (
                    <label key={field} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!visibleColumns[field]}
                        onChange={() => toggleColumn(field)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 select-none">
                        {FIELD_LABELS[field]}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="border-t border-gray-100 mt-2 pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      const all = DISPLAY_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {});
                      setVisibleColumns(all);
                      localStorage.setItem('orders_visible_columns', JSON.stringify(all));
                    }}
                    className="flex-1 text-xs py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                  >
                    اظهار الكل
                  </button>
                  <button
                    onClick={() => {
                      const none = DISPLAY_FIELDS.reduce((acc, f) => ({ ...acc, [f]: false }), {});
                      setVisibleColumns(none);
                      localStorage.setItem('orders_visible_columns', JSON.stringify(none));
                    }}
                    className="flex-1 text-xs py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    اخفاء الكل
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* أزرار فلترة الطلبات */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3">فلترة الطلبات حسب الحالة</h3>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                statusFilter === filter.key
                  ? `${filter.color} ring-2 ring-blue-500 ring-opacity-50 shadow-md`
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              {filter.label}
              <span className="mr-2 bg-white bg-opacity-70 px-2 py-0.5 rounded-full text-xs">
                {getStatusCount(filter.key)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* فلتر التاريخ */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3">فلترة الطلبات حسب التاريخ</h3>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            كل الأوقات
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'today'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setDateFilter('yesterday')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'yesterday'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            أمس
          </button>
          <button
            onClick={() => setDateFilter('last7')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'last7'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setDateFilter('last30')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'last30'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            آخر 30 يوم
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'custom'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            تاريخ مخصص
          </button>
        </div>

        {/* حقول التاريخ المخصص */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                من تاريخ
              </label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {(customDateFrom || customDateTo) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCustomDateFrom('');
                    setCustomDateTo('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  مسح التواريخ
                </button>
              </div>
            )}
          </div>
        )}

        {/* عرض الحالة النشطة */}
        <div className="mt-3 text-sm text-gray-600">
          عرض: <span className="font-semibold">{filteredOrders.length}</span> من أصل <span className="font-semibold">{orders.length}</span> طلب
        </div>
      </div>

      {loading && <p className="text-center py-4">جاري التحميل...</p>}

      {error && (
        <div className="text-red-500 text-center py-4 mb-4">
          <p>{error}</p>
          <button onClick={fetchOrders} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
              <tr>
                {activeFields.map((field) => (
                  <th key={field} className="p-3 text-right border-b">{FIELD_LABELS[field]}</th>
                ))}
                <th className="p-3 text-right border-b">الحالة والإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const hasNoItems = !order.items || order.items.length === 0;
                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-gray-50 ${hasNoItems ? 'bg-amber-50 border-r-4 border-amber-500' : ''}`}
                    >
                      {activeFields.map((field) => (
                        <td key={field} className="p-3 border-b text-right">
                          {field === 'address' ? (
                          <button
                            onClick={() => handleAddressClick(order)}
                            className="text-blue-500 hover:underline"
                          >
                            {order.address}
                          </button>
                        ) : field === 'vendor_name' && order.is_multi_vendor ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs font-semibold rounded-full">
                              متعدد المتاجر
                            </span>
                            <div className="text-sm text-gray-700">
                              {order.vendor_names && order.vendor_names.length > 0 && (
                                <span className="text-xs">({order.vendor_names.join(', ')})</span>
                              )}
                            </div>
                          </div>
                        ) : field === 'name' ? (
                          <div className="max-w-md">
                            {order.items && order.items.length > 0 ? (
                              <div className="space-y-2">
                                {order.items.map((item, idx) => {
                                  // حساب سعر الإضافات
                                  const addonsPrice = item.addons_data && Array.isArray(item.addons_data)
                                    ? item.addons_data.reduce((sum, addon) => {
                                        const addonQty = addon.quantity || 1;
                                        const addonPrice = addon.price || 0;
                                        return sum + (addonQty * addonPrice);
                                      }, 0)
                                    : 0;

                                  // السعر الأساسي = استخدام سعر المنتج من products إذا كان متاحاً، وإلا طرح الإضافات من item.price
                                  let baseUnitPrice = parseFloat(item.product?.price || item.price || 0);

                                  // إذا كان item.price يتضمن الإضافات، اطرحها
                                  if (!item.product?.price && addonsPrice > 0) {
                                    baseUnitPrice = parseFloat(item.price || 0) - addonsPrice;
                                  }

                                  const basePrice = baseUnitPrice * (item.quantity || 1);
                                  const itemTotal = parseFloat(item.total || (basePrice + addonsPrice));

                                  return (
                                    <div key={idx} className="text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900">
                                            {item.product?.name || item.product_name || item.name || 'منتج'}
                                            <span className="mr-1 text-blue-600 font-semibold">(×{item.quantity})</span>
                                          </div>
                                          {item.variant_name && (
                                            <div className="text-xs text-blue-600 mt-0.5">النوع: {item.variant_name}</div>
                                          )}
                                        </div>
                                        <div className="text-left flex-shrink-0">
                                          <div className="text-sm font-semibold text-gray-700">
                                            {basePrice.toFixed(2)} ₪
                                          </div>
                                        </div>
                                      </div>
                                      {item.addons_data && Array.isArray(item.addons_data) && item.addons_data.length > 0 && (
                                        <div className="mr-3 space-y-1">
                                          {item.addons_data.map((addon, addonIdx) => {
                                            const addonName = addon.name || addon.addon_name;
                                            const addonQty = addon.quantity || 1;
                                            const addonPrice = addon.price || 0;
                                            const addonTotal = addonQty * addonPrice;
                                            return (
                                              <div key={addonIdx} className="flex items-center justify-between text-xs">
                                                <span className="text-amber-700">
                                                  + {addonName} {addonQty > 1 && `(×${addonQty})`}
                                                </span>
                                                <span className="text-amber-600 font-semibold">
                                                  {addonTotal.toFixed(2)} ₪
                                                </span>
                                              </div>
                                            );
                                          })}
                                          <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                                            <span className="text-xs font-semibold text-emerald-700">المجموع:</span>
                                            <span className="text-sm font-bold text-emerald-600">
                                              {itemTotal.toFixed(2)} ₪
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-amber-700 font-semibold">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>لا توجد منتجات</span>
                              </div>
                            )}
                          </div>
                        ) : field === 'notes' ? (
                          <div className="max-w-xs">
                            {order.notes ? (
                              <div className="group relative">
                                <div className="text-sm text-gray-700 truncate">
                                  {order.notes.length > 50 ? `${order.notes.substring(0, 50)}...` : order.notes}
                                </div>
                                {order.notes.length > 50 && (
                                  <div className="invisible group-hover:visible absolute z-10 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 bottom-full left-0 mb-2 w-64 shadow-lg">
                                    {order.notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </div>
                        ) : field === 'discount_info' ? (
                          <div className="space-y-1 min-w-[120px]">
                            {(() => {
                              const coupon = parseFloat(order.coupon_discount || 0);
                              const points = parseFloat(order.points_discount || 0);
                              const vendor = parseFloat(order.vendor_discount_amount || 0);
                              const vendorPct = parseFloat(order.vendor_discount_percentage || 0);
                              const wallet = parseFloat(order.wallet_amount || 0);
                              const hasVendorDiscount = vendor > 0 || (vendorPct > 0 && order.vendor_discount_id);
                              const hasDiscount = coupon > 0 || points > 0 || hasVendorDiscount || wallet > 0;
                              if (!hasDiscount) return <span className="text-gray-400 text-sm">-</span>;
                              return (
                                <>
                                  {hasVendorDiscount && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                        خصم متجر {vendorPct > 0 ? `${vendorPct}%` : ''}
                                      </span>
                                      {vendor > 0 && <span className="text-sm font-bold text-blue-700">-{vendor.toFixed(2)} ₪</span>}
                                    </div>
                                  )}
                                  {coupon > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        كوبون
                                      </span>
                                      <span className="text-sm font-bold text-emerald-700">-{coupon.toFixed(2)} ₪</span>
                                    </div>
                                  )}
                                  {points > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                        نقاط
                                      </span>
                                      <span className="text-sm font-bold text-amber-700">-{points.toFixed(2)} ₪</span>
                                    </div>
                                  )}
                                  {wallet > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                        محفظة
                                      </span>
                                      <span className="text-sm font-bold text-sky-700">{wallet.toFixed(2)} ₪</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : field === 'total' ? (
                          <span className="font-bold text-gray-800">{Number(order.total || 0).toFixed(2)} ₪</span>
                        ) : (
                          formatCellValue(order[field], field)
                        )}
                      </td>
                    ))}
                    <td className="p-3 border-b">
                      <div className="flex flex-col gap-2">
                        <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(order.status)} w-fit`}>
                          {order.status_text || formatCellValue(order.status, 'status')}
                        </span>
                        <div className="flex space-x-2">
                          {order.status === 'pending_review' && (
                            <button
                              onClick={() => handleApproveOrder(order)}
                              className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 ml-2 text-xs font-semibold"
                            >
                              ✓ قبول الطلب
                            </button>
                          )}
                          <button
                            onClick={() => handleActionClick(order)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 ml-2 text-xs"
                          >
                            إجراءات
                          </button>
                          <button
                            onClick={() => handleEditClick(order)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 ml-2 text-xs"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteClick(order)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={activeFields.length + 1} className="p-4 text-center text-gray-500">
                    {statusFilter === 'all' ? 'لا توجد طلبات' : `لا توجد طلبات ${statusFilters.find(f => f.key === statusFilter)?.label.toLowerCase()}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showProcessingModal && selectedOrder && (
        <Transition appear show={showProcessingModal} as={Fragment}>
          <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => { setShowProcessingModal(false); fetchOrders(); }}>
            <div className="min-h-screen px-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
              </Transition.Child>
              <span className="inline-block h-screen align-middle">&#8203;</span>
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <div className="inline-block w-full max-w-3xl my-8 text-right align-middle transition-all transform">
                  <OrderProcessing order={selectedOrder} onClose={() => { setShowProcessingModal(false); fetchOrders(); }} onStatusUpdate={handleStatusUpdate} isModal={true} />
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Address Map Modal */}
      {selectedAddress && (
        <AddressMapModal 
          isOpen={showAddressMap}
          onClose={() => {
            setShowAddressMap(false);
            setSelectedAddress(null);
          }}
          address={selectedAddress.address}
          latitude={selectedAddress.geocoded_latitude}
          longitude={selectedAddress.geocoded_longitude}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setShowDeleteConfirm(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
            </Transition.Child>

            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-right align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  تأكيد حذف الطلب
                </Dialog.Title>

                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    هل أنت متأكد من رغبتك في حذف هذا الطلب؟ هذا الإجراء لا يمكن التراجع عنه.
                  </p>
                </div>

                {orderToDelete && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p><span className="font-bold">رقم الطلب:</span> {orderToDelete.id.substring(0, 8)}</p>
                    <p><span className="font-bold">العميل:</span> {orderToDelete.customer_name}</p>
                    <p><span className="font-bold">المبلغ:</span> {formatCellValue(orderToDelete.total, 'total')}</p>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 ${
                      deletingOrder ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    onClick={handleDeleteConfirm}
                    disabled={deletingOrder}
                  >
                    {deletingOrder ? 'جاري الحذف...' : 'حذف الطلب'}
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Pagination Controls */}
      {!loading && totalOrders > ordersPerPage && (
        <div className="mt-6 flex items-center justify-between bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">
            عرض {((currentPage - 1) * ordersPerPage) + 1} - {Math.min(currentPage * ordersPerPage, totalOrders)} من أصل {totalOrders} طلب
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              السابق
            </button>
            <span className="px-4 py-2 bg-gray-100 rounded">
              صفحة {currentPage} من {Math.ceil(totalOrders / ordersPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalOrders / ordersPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(totalOrders / ordersPerPage)}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {orderToEdit && (
        <EditOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setOrderToEdit(null);
          }}
          order={orderToEdit}
          onSave={() => {
            fetchOrders();
          }}
        />
      )}

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
                    تحذير: حذف جميع الطلبات
                  </Dialog.Title>

                  <div className="mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-red-800 font-semibold mb-2">
                        هذا الإجراء خطير ولا يمكن التراجع عنه!
                      </p>
                      <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>سيتم حذف جميع الطلبات ({orders.length} طلب)</li>
                        <li>سيتم حذف جميع عناصر الطلبات المرتبطة</li>
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