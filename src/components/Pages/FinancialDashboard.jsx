import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { getFinancialStats, getMonthlySalesStats } from '../../lib/statisticsApi';

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function FinancialDashboard() {
  const [financialData, setFinancialData] = useState({
    // Admin commissions
    adminCommissions: {
      total: 0,
      fromVendors: 0,
      fromDrivers: 0,
      pendingFromVendors: 0,
      pendingFromDrivers: 0,
      byPaymentType: {
        electronic: 0,
        cash: 0
      },
      monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    
    // Vendor balances
    vendorBalances: {
      total: 0,
      available: 0,
      pending: 0,
      byPaymentType: {
        electronic: 0,
        cash: 0
      },
      monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    
    // Driver balances
    driverBalances: {
      total: 0,
      available: 0,
      pending: 0,
      byPaymentType: {
        electronic: 0,
        cash: 0
      },
      monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    
    // Total sales
    totalSales: {
      amount: 0,
      electronic: 0,
      cash: 0,
      monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch financial stats from the API
      const stats = await getFinancialStats();
      
      // Fetch monthly sales data
      const { monthlySales } = await getMonthlySalesStats();
      
      // Calculate monthly commission (estimated as 15% of sales)
      const monthlyCommissions = monthlySales.map(amount => Math.round(amount * 0.15));
      
      // Update the state with the fetched data
      setFinancialData({
        adminCommissions: {
          total: safeNum(stats.admin_commissions),
          fromVendors: safeNum(stats.admin_commissions_vendors),
          fromDrivers: safeNum(stats.admin_commissions_drivers),
          pendingFromVendors: safeNum(stats.pending_commissions_vendors),
          pendingFromDrivers: safeNum(stats.pending_commissions_drivers),
          byPaymentType: {
            electronic: safeNum(stats.admin_commissions_electronic),
            cash: safeNum(stats.admin_commissions_cash)
          },
          monthly: monthlyCommissions
        },
        vendorBalances: {
          total: safeNum(stats.vendor_balances),
          available: safeNum(stats.vendor_available_balances),
          pending: safeNum(stats.vendor_pending_balances),
          byPaymentType: {
            electronic: safeNum(stats.vendor_balances_electronic),
            cash: safeNum(stats.vendor_balances_cash)
          },
          monthly: monthlySales.map(amount => Math.round(amount * 0.7))
        },
        driverBalances: {
          total: safeNum(stats.driver_balances),
          available: safeNum(stats.driver_available_balances),
          pending: safeNum(stats.driver_pending_balances),
          byPaymentType: {
            electronic: safeNum(stats.driver_balances_electronic),
            cash: safeNum(stats.driver_balances_cash)
          },
          monthly: monthlySales.map(amount => Math.round(amount * 0.3))
        },
        totalSales: {
          amount: safeNum(stats.total_sales),
          electronic: safeNum(stats.electronic_payments),
          cash: safeNum(stats.cash_payments),
          monthly: monthlySales
        }
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
      setError('فشل في تحميل البيانات المالية. الرجاء المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const salesTotal = Number(financialData.totalSales.amount) || 0;
  const paymentShare = (amount) => salesTotal > 0 ? ((Number(amount) || 0) / salesTotal * 100).toFixed(1) : '0.0';
  
  const salesChartData = {
    labels: months,
    datasets: [
      {
        label: 'المبيعات الكلية',
        data: financialData.totalSales.monthly,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4
      },
      {
        label: 'عمولات الإدارة',
        data: financialData.adminCommissions.monthly,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.4
      }
    ]
  };

  const balanceChartData = {
    labels: months,
    datasets: [
      {
        label: 'أرصدة البائعين',
        data: financialData.vendorBalances.monthly,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        tension: 0.4
      },
      {
        label: 'أرصدة السائقين',
        data: financialData.driverBalances.monthly,
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        tension: 0.4
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="text-lg font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button 
          onClick={() => fetchFinancialData()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">لوحة المعلومات المالية</h2>
      
      {/* Admin Commissions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">عمولات الإدارة</h3>
          <div className="text-3xl font-bold text-green-600">₪{financialData.adminCommissions.total.toLocaleString()}</div>
          <p className="text-gray-500 mt-2">الرصيد الكلي: ₪{financialData.adminCommissions.total.toLocaleString()}</p>
          <div className="mt-2 text-sm">
            <div className="flex justify-between">
              <span>من البائعين:</span>
              <span className="font-medium">₪{financialData.adminCommissions.fromVendors.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>من السائقين:</span>
              <span className="font-medium">₪{financialData.adminCommissions.fromDrivers.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">العمولات حسب طريقة الدفع</h3>
          <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <span>الدفع الإلكتروني:</span>
              <span className="font-bold">₪{financialData.adminCommissions.byPaymentType.electronic.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${financialData.adminCommissions.total > 0 ? (financialData.adminCommissions.byPaymentType.electronic / financialData.adminCommissions.total) * 100 : 0}%` }}></div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
              <span>الدفع النقدي:</span>
              <span className="font-bold">₪{financialData.adminCommissions.byPaymentType.cash.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${financialData.adminCommissions.total > 0 ? (financialData.adminCommissions.byPaymentType.cash / financialData.adminCommissions.total) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">العمولات المعلقة</h3>
          <div className="text-3xl font-bold text-yellow-600">₪{(financialData.adminCommissions.pendingFromVendors + financialData.adminCommissions.pendingFromDrivers).toLocaleString()}</div>
          <div className="mt-2 text-sm">
            <div className="flex justify-between">
              <span>من البائعين:</span>
              <span className="font-medium">₪{financialData.adminCommissions.pendingFromVendors.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>من السائقين:</span>
              <span className="font-medium">₪{financialData.adminCommissions.pendingFromDrivers.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Vendor & Driver Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendor Balances */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">أرصدة البائعين</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد الكلي:</span>
              <span className="text-xl font-bold">₪{financialData.vendorBalances.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد المتاح:</span>
              <span className="text-lg font-semibold text-green-600">₪{financialData.vendorBalances.available.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد المعلق:</span>
              <span className="text-lg font-semibold text-yellow-600">₪{financialData.vendorBalances.pending.toLocaleString()}</span>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">حسب طريقة الدفع:</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">الدفع الإلكتروني</p>
                  <p className="text-lg font-semibold">₪{financialData.vendorBalances.byPaymentType.electronic.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">الدفع النقدي</p>
                  <p className="text-lg font-semibold">₪{financialData.vendorBalances.byPaymentType.cash.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Driver Balances */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">أرصدة السائقين</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد الكلي:</span>
              <span className="text-xl font-bold">₪{financialData.driverBalances.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد المتاح:</span>
              <span className="text-lg font-semibold text-green-600">₪{financialData.driverBalances.available.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الرصيد المعلق:</span>
              <span className="text-lg font-semibold text-yellow-600">₪{financialData.driverBalances.pending.toLocaleString()}</span>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">حسب طريقة الدفع:</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">الدفع الإلكتروني</p>
                  <p className="text-lg font-semibold">₪{financialData.driverBalances.byPaymentType.electronic.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">الدفع النقدي</p>
                  <p className="text-lg font-semibold">₪{financialData.driverBalances.byPaymentType.cash.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Total Sales */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">إجمالي المبيعات</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">إجمالي المبيعات</p>
            <p className="text-2xl font-bold">₪{financialData.totalSales.amount.toLocaleString()}</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">الدفع الإلكتروني</p>
            <p className="text-2xl font-bold">₪{financialData.totalSales.electronic.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">
              {paymentShare(financialData.totalSales.electronic)}% من المبيعات
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">الدفع النقدي</p>
            <p className="text-2xl font-bold">₪{financialData.totalSales.cash.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">
              {paymentShare(financialData.totalSales.cash)}% من المبيعات
            </p>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">المبيعات والعمولات الشهرية</h3>
          <div className="h-80">
            <Line data={salesChartData} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">أرصدة البائعين والسائقين</h3>
          <div className="h-80">
            <Line data={balanceChartData} />
          </div>
        </div>
      </div>
      
      {/* Payment Details */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">تفاصيل المدفوعات حسب طريقة الدفع</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي المبيعات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عمولات الإدارة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">أرصدة البائعين</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">أرصدة السائقين</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap font-medium">الدفع الإلكتروني</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.totalSales.electronic.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.adminCommissions.byPaymentType.electronic.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.vendorBalances.byPaymentType.electronic.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.driverBalances.byPaymentType.electronic.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap font-medium">الدفع النقدي</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.totalSales.cash.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.adminCommissions.byPaymentType.cash.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.vendorBalances.byPaymentType.cash.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.driverBalances.byPaymentType.cash.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap">الإجمالي</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.totalSales.amount.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.adminCommissions.total.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.vendorBalances.total.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">₪{financialData.driverBalances.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}