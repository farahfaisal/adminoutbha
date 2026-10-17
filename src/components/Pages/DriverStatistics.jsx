import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverStatistics } from '../../lib/driverStatisticsApi';
import { toast } from 'react-toastify';
import { TrendingUp, DollarSign, Truck, Star, Download, Calendar, FileText } from 'lucide-react';

export default function DriverStatistics() {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('total_trips');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [expandedDrivers, setExpandedDrivers] = useState({});

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const months = [
    { value: '1', label: 'يناير' },
    { value: '2', label: 'فبراير' },
    { value: '3', label: 'مارس' },
    { value: '4', label: 'أبريل' },
    { value: '5', label: 'مايو' },
    { value: '6', label: 'يونيو' },
    { value: '7', label: 'يوليو' },
    { value: '8', label: 'أغسطس' },
    { value: '9', label: 'سبتمبر' },
    { value: '10', label: 'أكتوبر' },
    { value: '11', label: 'نوفمبر' },
    { value: '12', label: 'ديسمبر' }
  ];

  useEffect(() => {
    fetchStatistics();
  }, [selectedMonth, selectedYear]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (selectedYear) {
        filters.year = parseInt(selectedYear);
      }
      if (selectedMonth) {
        filters.month = parseInt(selectedMonth);
      }
      const data = await getDriverStatistics(null, filters);
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('فشل في تحميل الإحصائيات');
    } finally {
      setLoading(false);
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

  const toggleDriverExpansion = (driverId) => {
    setExpandedDrivers(prev => ({
      ...prev,
      [driverId]: !prev[driverId]
    }));
  };

  const filteredAndSortedStats = statistics
    .filter(stat =>
      stat.driver_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      return (aValue - bValue) * modifier;
    });

  const totalStats = {
    total_trips: statistics.reduce((sum, s) => sum + s.total_trips, 0),
    total_delivery_fees: statistics.reduce((sum, s) => sum + s.total_delivery_fees, 0),
    store_commission: statistics.reduce((sum, s) => sum + s.store_commission, 0),
    driver_earnings: statistics.reduce((sum, s) => sum + s.driver_earnings, 0)
  };

  const exportToCSV = () => {
    const headers = ['اسم السائق', 'عدد الرحلات', 'إجمالي رسوم التوصيل', 'إيرادات السائق', 'عمولة المتجر', 'معدل العمولة', 'التقييم'];
    const rows = filteredAndSortedStats.map(stat => [
      stat.driver_name,
      stat.total_trips,
      stat.total_delivery_fees.toFixed(2),
      stat.driver_earnings.toFixed(2),
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
    link.download = `driver_statistics_${new Date().toISOString().split('T')[0]}.csv`;
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">إحصائيات السائقين</h1>
        <p className="text-gray-600">تقرير شامل لرحلات وعمولات السائقين</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">إجمالي الرحلات</h3>
            <Truck className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{totalStats.total_trips}</p>
          <p className="text-sm opacity-80 mt-1">{statistics.length} سائق</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">رسوم التوصيل</h3>
            <TrendingUp className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.total_delivery_fees.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">إجمالي الرسوم</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">إيرادات السائقين</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.driver_earnings.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">بعد خصم العمولة</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">عمولة المتجر</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">₪{totalStats.store_commission.toFixed(2)}</p>
          <p className="text-sm opacity-80 mt-1">من جميع السائقين</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">فلاتر الإحصائيات</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">السنة</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">جميع السنوات</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الشهر</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">جميع الأشهر</option>
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <input
              type="text"
              placeholder="بحث عن سائق..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              تصدير CSV
            </button>
          </div>
        </div>

        {(selectedMonth || selectedYear) && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              عرض إحصائيات {selectedMonth ? months.find(m => m.value === selectedMonth)?.label : ''} {selectedYear}
            </span>
            <button
              onClick={() => {
                setSelectedMonth('');
                setSelectedYear(new Date().getFullYear().toString());
              }}
              className="mr-auto text-sm text-blue-600 hover:text-blue-800 underline"
            >
              إعادة تعيين
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم السائق
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_trips')}
                >
                  عدد الرحلات {sortBy === 'total_trips' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_delivery_fees')}
                >
                  رسوم التوصيل {sortBy === 'total_delivery_fees' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('driver_earnings')}
                >
                  إيرادات السائق {sortBy === 'driver_earnings' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                <React.Fragment key={stat.driver_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleDriverExpansion(stat.driver_id)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {expandedDrivers[stat.driver_id] ? '▼' : '►'}
                        </button>
                        <div className="text-sm font-medium text-gray-900">{stat.driver_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">{stat.total_trips}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">₪{stat.total_delivery_fees.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-green-600 font-semibold">₪{stat.driver_earnings.toFixed(2)}</div>
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
                        <div>نقدي: ₪{stat.delivery_fees_by_payment.cash.toFixed(2)}</div>
                        <div>إلكتروني: ₪{stat.delivery_fees_by_payment.electronic.toFixed(2)}</div>
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
                      <button
                        onClick={() => navigate(`/admin-dashboard/driver-settlement/${stat.driver_id}`)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        التسوية
                      </button>
                    </td>
                  </tr>

                  {expandedDrivers[stat.driver_id] && stat.daily_stats && (
                    <tr>
                      <td colSpan="9" className="px-6 py-4 bg-gray-50">
                        <div className="mb-2 font-semibold text-gray-700">الإحصائيات اليومية:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(stat.daily_stats)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .map(([date, dailyStat]) => (
                              <div key={date} className="bg-white p-3 rounded-lg border border-gray-200">
                                <div className="text-sm font-medium text-gray-900 mb-2">
                                  {new Date(date).toLocaleDateString('ar-EG', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex justify-between">
                                    <span>الرحلات:</span>
                                    <span className="font-semibold text-blue-600">{dailyStat.trips}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>رسوم التوصيل:</span>
                                    <span className="font-semibold text-green-600">₪{dailyStat.delivery_fees.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
