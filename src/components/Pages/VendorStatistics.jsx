import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVendorStatistics } from '../../lib/vendorStatisticsApi';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { TrendingUp, DollarSign, ShoppingBag, Star, Download, FileText, AlertCircle } from 'lucide-react';

export default function VendorStatistics() {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('total_sales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingSettlements, setPendingSettlements] = useState({});

  useEffect(() => {
    fetchStatistics();
    fetchPendingSettlements();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const data = await getVendorStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('فشل في تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingSettlements = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_settlements')
        .select('vendor_id, store_commission')
        .eq('is_settled', false);

      if (error) throw error;

      const pending = {};
      data.forEach(settlement => {
        if (!pending[settlement.vendor_id]) {
          pending[settlement.vendor_id] = 0;
        }
        pending[settlement.vendor_id] += parseFloat(settlement.store_commission || 0);
      });

      setPendingSettlements(pending);
    } catch (error) {
      console.error('Error fetching pending settlements:', error);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedStats = statistics
    .filter(stat =>
      stat.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      return (aValue - bValue) * modifier;
    });

  const totalStats = {
    total_sales: statistics.reduce((sum, s) => sum + s.total_sales, 0),
    total_orders: statistics.reduce((sum, s) => sum + s.total_orders, 0),
    store_commission: statistics.reduce((sum, s) => sum + s.store_commission, 0),
    vendor_earnings: statistics.reduce((sum, s) => sum + s.vendor_earnings, 0)
  };

  const exportToCSV = () => {
    const headers = ['اسم البائع', 'إجمالي المبيعات', 'عدد الطلبات', 'إيرادات البائع', 'عمولة المتجر', 'معدل العمولة', 'التقييم'];
    const rows = filteredAndSortedStats.map(stat => [
      stat.vendor_name,
      stat.total_sales.toFixed(2),
      stat.total_orders,
      stat.vendor_earnings.toFixed(2),
      stat.store_commission.toFixed(2),
      `${stat.commission_rate}%`,
      `${stat.rating?.toFixed(1) || 0} (${stat.rating_count || 0})`
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendor_statistics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">إحصائيات البائعين</h1>
        <p className="text-gray-600">تقرير شامل لمبيعات وعمولات البائعين</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">إجمالي المبيعات</h3>
            <TrendingUp className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.total_sales.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">{statistics.length} بائع</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">عدد الطلبات</h3>
            <ShoppingBag className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{totalStats.total_orders}</p>
          <p className="text-sm opacity-80 mt-1">طلب مكتمل</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">إيرادات البائعين</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.vendor_earnings.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">بعد خصم العمولة</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">عمولة المتجر</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.store_commission.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">من جميع البائعين</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="بحث عن بائع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            تصدير CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم البائع
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_sales')}
                >
                  إجمالي المبيعات {sortBy === 'total_sales' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_orders')}
                >
                  عدد الطلبات {sortBy === 'total_orders' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('vendor_earnings')}
                >
                  إيرادات البائع {sortBy === 'vendor_earnings' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('store_commission')}
                >
                  عمولة المتجر {sortBy === 'store_commission' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  معدل العمولة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نقدي / إلكتروني
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('rating')}
                >
                  التقييم {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedStats.map((stat) => (
                <tr key={stat.vendor_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{stat.vendor_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-semibold">₪{stat.total_sales.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{stat.total_orders}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-green-600 font-semibold">₪{stat.vendor_earnings.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-orange-600 font-semibold">₪{stat.store_commission.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {stat.commission_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-600">
                      <div>نقدي: ₪{stat.sales_by_payment.cash.toFixed(2)}</div>
                      <div>إلكتروني: ₪{stat.sales_by_payment.electronic.toFixed(2)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{stat.rating?.toFixed(1) || 0}</span>
                      <span className="text-gray-500">({stat.rating_count || 0})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin-dashboard/vendor-settlement/${stat.vendor_id}`)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        التسوية
                      </button>
                      {pendingSettlements[stat.vendor_id] > 0 && (
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <AlertCircle className="w-4 h-4" />
                          <span>معلق</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedStats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">لا توجد بيانات</p>
          </div>
        )}
      </div>
    </div>
  );
}
