import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { getVendorWallets, getDriverWallets, chargeVendorWallet, chargeDriverWallet, processOrderPayment } from '../../lib/walletApi';
import { supabase } from '../../lib/supabase';

export default function Wallet() {
  const [balance, setBalance] = useState({
    total: 0,
    pending: 0
  });

  const [transactions, setTransactions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('vendors'); // 'vendors' or 'drivers'

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showProcessPaymentModal, setShowProcessPaymentModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const initialFilters = {
    name: {
      type: 'text',
      label: 'الاسم',
      placeholder: 'البحث بالاسم',
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'inactive', label: 'غير نشط' }
      ],
      value: ''
    },
    wallet_enabled: {
      type: 'select',
      label: 'المحفظة',
      placeholder: 'الكل',
      options: [
        { value: 'true', label: 'مفعلة' },
        { value: 'false', label: 'غير مفعلة' }
      ],
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // جلب بيانات البائعين مباشرة
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, store_name, status, wallet_enabled');
      
      if (vendorsError) throw vendorsError;
      
      // جلب بيانات محافظ البائعين
      const { data: vendorWalletsData, error: vendorWalletsError } = await supabase
        .from('vendor_wallets')
        .select('id, vendor_id, balance, total_earnings, total_withdrawals');
      
      if (vendorWalletsError) throw vendorWalletsError;
      
      // جلب جميع الطلبات وحساب العدد لكل بائع باستخدام JavaScript
      const { data: allOrdersData, error: vendorOrdersError } = await supabase
        .from('orders')
        .select('vendor_id');
        
      if (vendorOrdersError) {
        console.error('Error fetching vendor orders:', vendorOrdersError);
      }
      
      // حساب عدد الطلبات لكل بائع
      const vendorOrderCounts = {};
      if (allOrdersData) {
        allOrdersData.forEach(order => {
          if (order.vendor_id) {
            vendorOrderCounts[order.vendor_id] = (vendorOrderCounts[order.vendor_id] || 0) + 1;
          }
        });
      }
      
      // دمج بيانات البائعين مع بيانات المحافظ
      const vendorsWithWallets = vendorsData.map(vendor => {
        const wallet = vendorWalletsData.find(w => w.vendor_id === vendor.id) || { 
          balance: 0, 
          total_earnings: 0, 
          total_withdrawals: 0 
        };
        
        const orderCount = vendorOrderCounts[vendor.id] || 0;
        
        return {
          id: vendor.id,
          name: vendor.store_name,
          balance: parseFloat(wallet.balance) || 0,
          wallet_enabled: vendor.wallet_enabled || false,
          auto_charge: vendor.auto_charge || false,
          total_orders: orderCount,
          total_sales: parseFloat(wallet.total_earnings) || 0,
          status: vendor.status || 'inactive',
          type: 'vendor'
        };
      });
      
      // جلب بيانات السائقين مباشرة
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('id, name, status');
      
      if (driversError) throw driversError;
      
      // جلب بيانات محافظ السائقين
      const { data: driverWalletsData, error: driverWalletsError } = await supabase
        .from('driver_wallets')
        .select('id, driver_id, balance, total_earnings, total_withdrawals');
      
      if (driverWalletsError) throw driverWalletsError;
      
      // جلب جميع الرحلات وحساب العدد لكل سائق باستخدام JavaScript
      const { data: allTripsData, error: driverTripsError } = await supabase
        .from('driver_trips')
        .select('driver_id');
        
      if (driverTripsError) {
        console.error('Error fetching driver trips:', driverTripsError);
      }
      
      // حساب عدد الرحلات لكل سائق
      const driverTripCounts = {};
      if (allTripsData) {
        allTripsData.forEach(trip => {
          if (trip.driver_id) {
            driverTripCounts[trip.driver_id] = (driverTripCounts[trip.driver_id] || 0) + 1;
          }
        });
      }
      
      // دمج بيانات السائقين مع بيانات المحافظ
      const driversWithWallets = driversData.map(driver => {
        const wallet = driverWalletsData.find(w => w.driver_id === driver.id) || { 
          balance: 0, 
          total_earnings: 0, 
          total_withdrawals: 0 
        };
        
        const tripCount = driverTripCounts[driver.id] || 0;
        
        return {
          id: driver.id,
          name: driver.name,
          balance: parseFloat(wallet.balance) || 0,
          wallet_enabled: true,
          auto_charge: false,
          total_orders: tripCount,
          total_sales: parseFloat(wallet.total_earnings) || 0,
          status: driver.status || 'inactive',
          type: 'driver'
        };
      });
      
      // حساب الأرصدة الإجمالية
      const totalVendorBalance = vendorsWithWallets.reduce((sum, vendor) => sum + (vendor.balance || 0), 0);
      const pendingVendorBalance = 0; // يمكن حسابها لاحقًا إذا لزم الأمر
      
      const totalDriverBalance = driversWithWallets.reduce((sum, driver) => sum + (driver.balance || 0), 0);
      const pendingDriverBalance = 0; // يمكن حسابها لاحقًا إذا لزم الأمر
      
      setBalance({
        total: totalVendorBalance + totalDriverBalance,
        pending: pendingVendorBalance + pendingDriverBalance
      });
      
      setVendors(vendorsWithWallets);
      setDrivers(driversWithWallets);
      
      // جلب آخر المعاملات
      try {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (transactionsError) throw transactionsError;
        setTransactions(transactionsData || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
      }
      
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setError('فشل في تحميل بيانات المحفظة. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل بيانات المحفظة');
      
      // Set default data for demonstration
      setBalance({
        total: 5000,
        pending: 1200
      });
      
      setVendors([
        {
          id: '1',
          name: 'متجر كوفي',
          balance: 2500,
          wallet_enabled: true,
          auto_charge: true,
          total_orders: 120,
          total_sales: 15000,
          status: 'active',
          type: 'vendor'
        },
        {
          id: '2',
          name: 'متجر الشاي',
          balance: 1800,
          wallet_enabled: true,
          auto_charge: false,
          total_orders: 85,
          total_sales: 10500,
          status: 'active',
          type: 'vendor'
        },
        {
          id: '3',
          name: 'متجر العصائر',
          balance: 700,
          wallet_enabled: true,
          auto_charge: true,
          total_orders: 45,
          total_sales: 5200,
          status: 'active',
          type: 'vendor'
        }
      ]);
      
      setDrivers([
        {
          id: '4',
          name: 'خالد أحمد',
          balance: 1200,
          wallet_enabled: true,
          auto_charge: false,
          total_orders: 80,
          total_sales: 8000,
          status: 'active',
          type: 'driver'
        },
        {
          id: '5',
          name: 'محمد علي',
          balance: 900,
          wallet_enabled: true,
          auto_charge: false,
          total_orders: 65,
          total_sales: 6500,
          status: 'active',
          type: 'driver'
        }
      ]);
      
      setTransactions([
        {
          id: 1,
          wallet_id: '1',
          amount: 500,
          type: 'credit',
          payment_type: 'cash',
          status: 'completed',
          description: 'شحن رصيد',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          wallet_id: '2',
          amount: 300,
          type: 'credit',
          payment_type: 'electronic',
          status: 'completed',
          description: 'دفع إلكتروني',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 3,
          wallet_id: '3',
          amount: 150,
          type: 'debit',
          payment_type: 'withdrawal',
          status: 'pending',
          description: 'سحب رصيد',
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeposit = async () => {
    if (!selectedUser || !depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('الرجاء اختيار المستخدم وإدخال المبلغ');
      return;
    }

    try {
      setDepositLoading(true);
      console.log("Selected user for deposit:", selectedUser);
      console.log("Deposit amount:", parseFloat(depositAmount));
      
      // استدعاء API لشحن الرصيد
      if (selectedUser.type === 'vendor') {
        console.log("Charging vendor wallet:", selectedUser.id, parseFloat(depositAmount));
        const result = await chargeVendorWallet(
          selectedUser.id, 
          parseFloat(depositAmount), 
          `شحن رصيد بواسطة المدير: ${depositAmount} شيكل`
        );
        
        console.log("Vendor charge result:", result);
        
        if (!result || !result.success) {
          throw new Error(result?.message || 'فشل في عملية الشحن');
        }
      } else if (selectedUser.type === 'driver') {
        console.log("Charging driver wallet:", selectedUser.id, parseFloat(depositAmount));
        const result = await chargeDriverWallet(
          selectedUser.id, 
          parseFloat(depositAmount), 
          `شحن رصيد بواسطة المدير: ${depositAmount} شيكل`
        );
        
        console.log("Driver charge result:", result);
        
        if (!result || !result.success) {
          throw new Error(result?.message || 'فشل في عملية الشحن');
        }
      }
      
      toast.success(`تم شحن ${depositAmount} شيكل بنجاح لحساب ${selectedUser.name}`);
      setShowDepositModal(false);
      setDepositAmount('');
      setSelectedUser(null);
      
      // تحديث البيانات
      fetchData();
    } catch (error) {
      console.error('Error charging wallet:', error);
      toast.error(error.message || 'فشل في عملية الشحن');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!orderId) {
      toast.error('الرجاء إدخال رقم الطلب');
      return;
    }

    try {
      setProcessingPayment(true);
      
      // معالجة دفع الطلب
      const result = await processOrderPayment(orderId);
      
      if (!result || !result.success) {
        throw new Error(result?.message || 'فشل في معالجة الدفع');
      }
      
      toast.success('تمت معالجة الدفع بنجاح');
      setShowProcessPaymentModal(false);
      setOrderId('');
      
      // تحديث البيانات
      fetchData();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'فشل في معالجة الدفع');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTransactionTypeDetails = (transaction) => {
    switch (transaction.type) {
      case 'credit':
        return {
          color: 'text-green-600',
          prefix: '+',
          text: transaction.payment_type === 'cash' ? 'إيداع نقدي' : 
                transaction.payment_type === 'admin_charge' ? 'شحن بواسطة المدير' : 
                'إيداع محفظة'
        };
      case 'debit':
        return {
          color: 'text-red-600',
          prefix: '-',
          text: transaction.payment_type === 'withdrawal' ? 'سحب رصيد' : 
                transaction.payment_type === 'commission' ? 'عمولة' : 
                'خصم'
        };
      default:
        return {
          color: 'text-gray-600',
          prefix: '',
          text: 'معاملة'
        };
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'pending': return 'معلق';
      case 'failed': return 'فشل';
      default: return status;
    }
  };

  const filteredVendors = filterData(vendors);
  const filteredDrivers = filterData(drivers);
  const currentData = activeTab === 'vendors' ? filteredVendors : filteredDrivers;

  if (loading && vendors.length === 0 && drivers.length === 0) {
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
          onClick={fetchData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">الرصيد المتاح</h3>
          <div className="text-3xl font-bold text-green-600">₪{(balance.total - balance.pending).toLocaleString()}</div>
          <p className="text-gray-500 mt-2">الرصيد الكلي: ₪{balance.total.toLocaleString()}</p>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              شحن رصيد
            </button>
            <button
              onClick={() => setShowProcessPaymentModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              معالجة دفع طلب
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">الرصيد المعلق</h3>
          <div className="text-3xl font-bold text-orange-600">₪{balance.pending.toLocaleString()}</div>
          <p className="text-gray-500 mt-2">سيتم تحويله خلال 24 ساعة</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'vendors' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              محافظ البائعين
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'drivers' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              محافظ السائقين
            </button>
          </div>
          <button
            onClick={() => setShowDepositModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            شحن رصيد
          </button>
        </div>

        <SearchFilter 
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-right py-3 px-4 bg-gray-50">{activeTab === 'vendors' ? 'المتجر' : 'السائق'}</th>
                <th className="text-right py-3 px-4 bg-gray-50">الرصيد</th>
                <th className="text-right py-3 px-4 bg-gray-50">المحفظة</th>
                {activeTab === 'vendors' && (
                  <th className="text-right py-3 px-4 bg-gray-50">الشحن التلقائي</th>
                )}
                <th className="text-right py-3 px-4 bg-gray-50">عدد الطلبات</th>
                <th className="text-right py-3 px-4 bg-gray-50">إجمالي المبيعات</th>
                <th className="text-right py-3 px-4 bg-gray-50">الحالة</th>
                <th className="text-right py-3 px-4 bg-gray-50">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'vendors' ? 8 : 7} className="px-6 py-4 text-center text-gray-500">
                    لا توجد {activeTab === 'vendors' ? 'بائعين' : 'سائقين'} متطابقين مع معايير البحث
                  </td>
                </tr>
              ) : (
                currentData.map(entity => (
                  <tr key={entity.id}>
                    <td className="py-3 px-4">{entity.name}</td>
                    <td className="py-3 px-4 font-semibold">₪{entity.balance.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        entity.wallet_enabled 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entity.wallet_enabled ? 'مفعلة' : 'غير مفعلة'}
                      </span>
                    </td>
                    {activeTab === 'vendors' && (
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          entity.auto_charge 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {entity.auto_charge ? 'مفعل' : 'غير مفعل'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4">{entity.total_orders}</td>
                    <td className="py-3 px-4">₪{entity.total_sales.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        entity.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entity.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSelectedUser(entity);
                          setShowDepositModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-3"
                      >
                        شحن رصيد
                      </button>
                      <button
                        onClick={() => {
                          // عرض المعاملات
                        }}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        السجل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">آخر المعاملات</h3>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-right py-2">التاريخ</th>
              <th className="text-right py-2">النوع</th>
              <th className="text-right py-2">المبلغ</th>
              <th className="text-right py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => {
              const typeDetails = getTransactionTypeDetails(transaction);
              return (
                <tr key={transaction.id}>
                  <td className="py-2">{new Date(transaction.created_at).toLocaleDateString('ar-SA')}</td>
                  <td className="py-2">{typeDetails.text}</td>
                  <td className={`py-2 ${typeDetails.color}`}>
                    {typeDetails.prefix}₪{Math.abs(transaction.amount).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(transaction.status)}`}>
                      {getStatusText(transaction.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deposit Modal */}
      <Dialog
        open={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          setSelectedUser(null);
          setDepositAmount('');
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              شحن رصيد
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اختر {activeTab === 'vendors' ? 'المتجر' : 'السائق'}
                </label>
                <select
                  value={selectedUser?.id || ''}
                  onChange={(e) => {
                    const entities = activeTab === 'vendors' ? vendors : drivers;
                    const entity = entities.find(v => v.id === e.target.value);
                    setSelectedUser(entity);
                  }}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">اختر {activeTab === 'vendors' ? 'المتجر' : 'السائق'}</option>
                  {(activeTab === 'vendors' ? vendors : drivers).map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} (رصيد: ₪{entity.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المبلغ (₪)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  min="1"
                  step="0.01"
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setSelectedUser(null);
                    setDepositAmount('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={depositLoading || !selectedUser || !depositAmount || parseFloat(depositAmount) <= 0}
                  className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
                    depositLoading || !selectedUser || !depositAmount || parseFloat(depositAmount) <= 0
                      ? 'opacity-70 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {depositLoading ? 'جاري الشحن...' : 'شحن الرصيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Process Payment Modal */}
      <Dialog
        open={showProcessPaymentModal}
        onClose={() => {
          setShowProcessPaymentModal(false);
          setOrderId('');
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              معالجة دفع طلب
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الطلب
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="أدخل رقم الطلب"
                />
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 text-sm">
                  <strong>ملاحظة:</strong> سيتم معالجة الدفع للطلب وتحديث محافظ البائع والسائق وفقًا لإعدادات العمولة.
                  تأكد من أن الطلب مكتمل قبل معالجة الدفع.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => {
                    setShowProcessPaymentModal(false);
                    setOrderId('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleProcessPayment}
                  disabled={processingPayment || !orderId}
                  className={`px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ${
                    processingPayment || !orderId
                      ? 'opacity-70 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {processingPayment ? 'جاري المعالجة...' : 'معالجة الدفع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}