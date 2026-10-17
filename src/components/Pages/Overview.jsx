import React, { useState, useEffect } from 'react';
import { supabase, supabaseQuery } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/formatters';

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    totalVendors: 0,
    totalDrivers: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    completionRate: 0
  });
  const [vendorStatusStats, setVendorStatusStats] = useState({
    active: 0,
    inactive: 0,
    busy: 0,
    suspended: 0,
    pending: 0
  });
  const [topVendors, setTopVendors] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchVendorStatusStats(),
        fetchTopVendors(),
        fetchRecentOrders()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) throw error;

      setStats({
        totalOrders: data?.totalOrders || 0,
        totalRevenue: safeNum(data?.totalRevenue),
        totalCustomers: data?.totalCustomers || 0,
        totalVendors: data?.totalVendors || 0,
        totalDrivers: data?.totalDrivers || 0,
        totalProducts: data?.totalProducts || 0,
        averageOrderValue: safeNum(data?.averageOrderValue),
        completionRate: safeNum(data?.completionRate)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('فشل في تحميل الإحصائيات');
    }
  };

  const fetchVendorStatusStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_vendor_status_stats');

      if (error) throw error;

      setVendorStatusStats({
        active: data?.active || 0,
        inactive: data?.inactive || 0,
        busy: data?.busy || 0,
        suspended: data?.suspended || 0,
        pending: data?.pending || 0
      });
    } catch (error) {
      console.error('Error fetching vendor status stats:', error);
    }
  };

  const fetchTopVendors = async () => {
    try {
      const { data, error } = await supabase.rpc('get_top_vendors', { limit_count: 5 });

      if (error) throw error;

      setTopVendors(data || []);
    } catch (error) {
      console.error('Error fetching top vendors:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data, error, status } = await supabaseQuery(
        () => supabase
          .from('orders')
          .select(`
            *,
            customer:customers!orders_customer_id_fkey(name),
            vendor:vendors!orders_vendor_id_fkey(store_name),
            driver:drivers!orders_driver_id_fkey(name)
          `)
          .order('created_at', { ascending: false })
          .limit(5)
      );

      if (status !== 200 && status !== 206) {
        throw new Error(`Failed to fetch recent orders. Status: ${status}`);
      }

      if (error) {
        throw new Error(`Recent orders error: ${error.message}`);
      }

      setRecentOrders(data);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      toast.error(`فشل في تحميل الطلبات الأخيرة: ${error.message}`);

      // Set empty array as fallback
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'فتح';
      case 'inactive': return 'إغلاق';
      case 'busy': return 'تعيين كمشغول';
      case 'suspended': return 'إيقاف';
      case 'pending': return 'تعليق';
      default: return status;
    }
  };

  const handleBulkVendorStatus = async (newStatus) => {
    const statusText = getStatusText(newStatus);
    const confirmMessage = `هل أنت متأكد من ${statusText} جميع المتاجر؟`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setBulkActionLoading(true);

      const { error } = await supabase
        .from('vendors')
        .update({ status: newStatus })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success(`تم ${statusText} جميع المتاجر بنجاح`);
      await fetchStats();
      await fetchVendorStatusStats();
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast.error(`فشل في ${statusText} المتاجر: ${error.message}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button 
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchStats();
            fetchTopVendors();
            fetchRecentOrders();
          }}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vendor Status Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">حالة المتاجر</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="text-3xl font-bold text-green-600">{vendorStatusStats.active}</div>
            <div className="text-sm text-green-700 font-medium mt-1">مفتوح</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg border-2 border-red-200">
            <div className="text-3xl font-bold text-red-600">{vendorStatusStats.inactive}</div>
            <div className="text-sm text-red-700 font-medium mt-1">مغلق</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600">{vendorStatusStats.busy}</div>
            <div className="text-sm text-yellow-700 font-medium mt-1">مشغول</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="text-3xl font-bold text-gray-600">{vendorStatusStats.suspended}</div>
            <div className="text-sm text-gray-700 font-medium mt-1">موقوف</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{vendorStatusStats.pending}</div>
            <div className="text-sm text-blue-700 font-medium mt-1">معلق</div>
          </div>
        </div>
      </div>

      {/* Bulk Actions for Vendors */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              التحكم السريع في جميع المتاجر
            </h3>
            <p className="text-sm text-gray-600">
              تطبيق حالة واحدة على جميع المتاجر دفعة واحدة
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkVendorStatus('active')}
              disabled={bulkActionLoading}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
            >
              {bulkActionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>فتح الكل</span>
            </button>
            <button
              onClick={() => handleBulkVendorStatus('inactive')}
              disabled={bulkActionLoading}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
            >
              {bulkActionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>إغلاق الكل</span>
            </button>
            <button
              onClick={() => handleBulkVendorStatus('busy')}
              disabled={bulkActionLoading}
              className="px-5 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
            >
              {bulkActionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>مشغول</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">إجمالي الطلبات</h3>
          <p className="text-3xl font-bold text-red-600">{stats.totalOrders}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">إجمالي الإيرادات</h3>
          <p className="text-3xl font-bold text-green-600">
            ₪{stats.totalRevenue.toFixed(2)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">متوسط قيمة الطلب</h3>
          <p className="text-3xl font-bold text-purple-600">
            ₪{stats.averageOrderValue.toFixed(2)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">معدل إكمال الطلبات</h3>
          <p className="text-3xl font-bold text-orange-600">
            {stats.completionRate.toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">عدد العملاء</h3>
          <p className="text-3xl font-bold text-red-600">{stats.totalCustomers}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">عدد البائعين</h3>
          <p className="text-3xl font-bold text-red-600">{stats.totalVendors}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">عدد السائقين</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.totalDrivers}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">عدد المنتجات</h3>
          <p className="text-3xl font-bold text-pink-600">{stats.totalProducts}</p>
        </div>
      </div>

      {/* Top Vendors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">أفضل البائعين</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد الطلبات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الإيرادات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topVendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{vendor.store_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{vendor.total_orders}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₪{safeNum(vendor.total_revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">آخر الطلبات</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الطلب</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العميل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السائق</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{order.order_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{order.customer?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{order.vendor?.store_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{order.driver?.name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₪{safeNum(order.total).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status === 'completed' ? 'مكتمل' :
                       order.status === 'cancelled' ? 'ملغي' :
                       order.status === 'pending' ? 'معلق' :
                       order.status === 'processing' ? 'قيد المعالجة' :
                       order.status === 'delivering' ? 'قيد التوصيل' :
                       order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}