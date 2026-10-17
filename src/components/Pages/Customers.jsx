import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { Trash2, CreditCard as Edit, Ban, CheckCircle, Wallet, FileText, CreditCard } from 'lucide-react';
import SearchFilter from '../SearchFilter';
import { chargeCustomerWallet, getCustomerWalletTransactions, getPendingDeposits, approveCustomerDeposit } from '../../lib/walletApi';
import { getRatingsByType } from '../../lib/ratingsApi';
import useFilters from '../../hooks/useFilters';
import { supabase } from '../../lib/supabase';
import { RatingStars } from '../Rating';
import { formatDate } from '../../utils/formatters';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [customerRatings, setCustomerRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showPendingDepositsModal, setShowPendingDepositsModal] = useState(false);
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [loadingPendingDeposits, setLoadingPendingDeposits] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    notes: ''
  });

  const [walletData, setWalletData] = useState({
    amount: '',
    description: 'شحن رصيد الزبون'
  });
  const [chargingWallet, setChargingWallet] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchCustomerRatings();
  }, []);

  const fetchCustomerRatings = async () => {
    try {
      const ratings = await getRatingsByType('customer');
      const ratingsByCustomer = {};
      ratings.forEach(rating => {
        if (!ratingsByCustomer[rating.to_id]) {
          ratingsByCustomer[rating.to_id] = [];
        }
        ratingsByCustomer[rating.to_id].push(rating);
      });
      setCustomerRatings(ratingsByCustomer);
    } catch (error) {
      console.error('Error fetching customer ratings:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      let customersData = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (customersError) throw new Error(`فشل في جلب بيانات الزبائن: ${customersError.message}`);
        if (!data || data.length === 0) break;
        customersData = customersData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      let walletsData = [];
      let wFrom = 0;
      while (true) {
        const { data, error: walletsError } = await supabase
          .from('customer_wallets')
          .select('*')
          .range(wFrom, wFrom + pageSize - 1);
        if (walletsError) { console.error('Error fetching customer wallets:', walletsError); break; }
        if (!data || data.length === 0) break;
        walletsData = walletsData.concat(data);
        if (data.length < pageSize) break;
        wFrom += pageSize;
      }
      let addressesData = [];
      let aFrom = 0;
      while (true) {
        const { data, error: addressesError } = await supabase
          .from('customer_addresses')
          .select('customer_id, address, detailed_address, city, is_default')
          .eq('is_default', true)
          .range(aFrom, aFrom + pageSize - 1);
        if (addressesError) { console.error('Error fetching customer addresses:', addressesError); break; }
        if (!data || data.length === 0) break;
        addressesData = addressesData.concat(data);
        if (data.length < pageSize) break;
        aFrom += pageSize;
      }

      const customersWithWallets = customersData.map(customer => {
        const customerWallet = walletsData?.find(wallet => wallet.customer_id === customer.id);
        const customerAddress = addressesData?.find(addr => addr.customer_id === customer.id);

        let fullAddress = customer.address || '';
        if (customerAddress) {
          const addressParts = [
            customerAddress.address,
            customerAddress.city
          ].filter(Boolean);
          fullAddress = addressParts.join(', ') || customerAddress.detailed_address || '';
        }

        return {
          ...customer,
          address: fullAddress,
          wallet_balance: customerWallet ? parseFloat(customerWallet.balance) || 0 : 0,
          wallet_id: customerWallet?.id
        };
      });

      setCustomers(customersWithWallets || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError(error.message || 'فشل في تحميل بيانات العملاء. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل بيانات العملاء');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const initialFilters = {
    name: {
      type: 'text',
      label: 'اسم العميل',
      placeholder: 'البحث باسم العميل',
      value: ''
    },
    phone: {
      type: 'text',
      label: 'رقم الهاتف',
      placeholder: 'البحث برقم الهاتف',
      value: ''
    },
    address: {
      type: 'text',
      label: 'العنوان',
      placeholder: 'البحث بالعنوان',
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'blocked', label: 'محظور' }
      ],
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      toast.error('الرجاء إدخال الاسم ورقم الهاتف');
      return;
    }

    try {
      setLoading(true);

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            email: formData.email,
            notes: formData.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast.success('تم تحديث بيانات العميل بنجاح');
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            email: formData.email,
            notes: formData.notes
          }]);

        if (error) throw error;
        toast.success('تم إضافة العميل بنجاح');
      }

      setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
      setEditingCustomer(null);
      setShowModal(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(editingCustomer ? 'فشل في تحديث بيانات العميل' : 'فشل في إضافة العميل');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      email: customer.email || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      setLoading(true);

      // Check if customer has any orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerToDelete.id);

      if (ordersError && ordersError.code !== 'PGRST116') {
        throw ordersError;
      }

      // Check if customer has parcel orders
      const { data: parcelOrdersData, error: parcelOrdersError } = await supabase
        .from('parcel_orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerToDelete.id);

      if (parcelOrdersError && parcelOrdersError.code !== 'PGRST116') {
        throw parcelOrdersError;
      }

      // If customer has orders, prevent deletion
      if (ordersData || parcelOrdersData) {
        toast.error('لا يمكن حذف العميل لأن لديه طلبات مسجلة. يمكنك حظر الحساب بدلاً من ذلك.');
        setShowDeleteModal(false);
        setCustomerToDelete(null);
        setLoading(false);
        return;
      }

      // Delete customer wallet transactions first
      const { error: walletTxError } = await supabase
        .from('customer_wallet_transactions')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (walletTxError && walletTxError.code !== 'PGRST116') {
        console.error('Error deleting wallet transactions:', walletTxError);
      }

      // Delete customer wallet
      const { error: walletError } = await supabase
        .from('customer_wallets')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error deleting wallet:', walletError);
      }

      // Delete customer addresses
      const { error: addressError } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (addressError && addressError.code !== 'PGRST116') {
        console.error('Error deleting addresses:', addressError);
      }

      // Delete points account
      const { error: pointsError } = await supabase
        .from('points_accounts')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (pointsError && pointsError.code !== 'PGRST116') {
        console.error('Error deleting points:', pointsError);
      }

      // Delete referral codes
      const { error: referralError } = await supabase
        .from('referral_codes')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (referralError && referralError.code !== 'PGRST116') {
        console.error('Error deleting referral codes:', referralError);
      }

      // Delete customer wholesale tiers
      const { error: wholesaleError } = await supabase
        .from('customer_wholesale_tiers')
        .delete()
        .eq('customer_id', customerToDelete.id);

      if (wholesaleError && wholesaleError.code !== 'PGRST116') {
        console.error('Error deleting wholesale tiers:', wholesaleError);
      }

      // Finally delete the customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);

      if (error) throw error;

      toast.success('تم حذف العميل بنجاح');
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(`فشل في حذف العميل: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (customerId) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      const newStatus = customer.status === 'active' ? 'blocked' : 'active';

      const { error } = await supabase
        .from('customers')
        .update({ status: newStatus })
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: newStatus } : c
      ));

      toast.success(`تم ${newStatus === 'active' ? 'إلغاء حظر' : 'حظر'} العميل بنجاح`);
    } catch (error) {
      console.error('Error updating customer status:', error);
      toast.error('فشل في تحديث حالة العميل');
    }
  };

  const handleChargeWallet = async () => {
    if (!selectedCustomer) {
      toast.error('الرجاء اختيار زبون');
      return;
    }

    if (!walletData.amount || parseFloat(walletData.amount) <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    try {
      setChargingWallet(true);
      const result = await chargeCustomerWallet(
        selectedCustomer.id,
        parseFloat(walletData.amount),
        walletData.description || 'شحن رصيد الزبون'
      );

      if (!result || !result.success) {
        throw new Error(result?.message || 'فشل في شحن محفظة الزبون');
      }

      toast.success(`تم شحن محفظة الزبون ${selectedCustomer.name} بمبلغ ${walletData.amount} شيكل بنجاح`);
      setWalletData({ amount: '', description: 'شحن رصيد الزبون' });
      setShowWalletModal(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error charging wallet:', error);
      toast.error(error.message || 'فشل في شحن محفظة الزبون');
    } finally {
      setChargingWallet(false);
    }
  };

  const fetchCustomerTransactions = async (customerId) => {
    try {
      setLoadingTransactions(true);
      const transactions = await getCustomerWalletTransactions(customerId);
      setCustomerTransactions(transactions || []);
    } catch (error) {
      console.error('Error fetching customer transactions:', error);
      toast.error('فشل في جلب معاملات المحفظة');
      setCustomerTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchPendingDeposits = async () => {
    try {
      setLoadingPendingDeposits(true);
      const deposits = await getPendingDeposits();
      setPendingDeposits(deposits || []);
    } catch (error) {
      console.error('Error fetching pending deposits:', error);
      toast.error('فشل في جلب طلبات الإيداع المعلقة');
      setPendingDeposits([]);
    } finally {
      setLoadingPendingDeposits(false);
    }
  };

  const handleApproveDeposit = async (depositId, action, note = '') => {
    try {
      const result = await approveCustomerDeposit(depositId, action, note);

      if (!result || !result.success) {
        throw new Error(result?.message || `فشل في ${action === 'approve' ? 'الموافقة على' : 'رفض'} طلب الإيداع`);
      }

      toast.success(`تم ${action === 'approve' ? 'الموافقة على' : 'رفض'} طلب الإيداع بنجاح`);
      fetchPendingDeposits();
      fetchCustomers();
    } catch (error) {
      console.error('Error approving deposit:', error);
      toast.error(error.message || `فشل في ${action === 'approve' ? 'الموافقة على' : 'رفض'} طلب الإيداع`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'blocked': return 'محظور';
      default: return status;
    }
  };

  const filteredCustomers = filterData(customers);

  if (loading && customers.length === 0) {
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
          onClick={fetchCustomers}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">الزبائن ({filteredCustomers.length})</h2>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
                  setShowModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <span>+</span>
                إضافة زبون جديد
              </button>
              <button
                onClick={() => {
                  setShowPendingDepositsModal(true);
                  fetchPendingDeposits();
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                <CreditCard size={18} />
                طلبات الإيداع ({pendingDeposits.length})
              </button>
            </div>
          </div>

          <SearchFilter
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          <div className="overflow-x-auto mt-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الهاتف</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التقييم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العنوان</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رصيد المحفظة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد الطلبات</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجمالي الإنفاق</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      لا يوجد زبائن متطابقين مع معايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        {customer.email && <div className="text-sm text-gray-500">{customer.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <RatingStars rating={customer.rating || 5} size="sm" />
                          <span className="text-xs text-gray-500 mt-1">
                            {customerRatings[customer.id] ? `(${customerRatings[customer.id].length} تقييم)` : `(${customer.rating_count || 0} تقييم)`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 max-w-xs truncate" title={customer.address || '-'}>
                        {customer.address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-green-600">₪{customer.wallet_balance.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {customer.orders_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">₪{(Number(customer.total_spent) || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(customer.status || 'active')}`}>
                          {getStatusText(customer.status || 'active')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEdit(customer)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="تعديل"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(customer.id)}
                            className={`transition-colors ${
                              (customer.status || 'active') === 'blocked'
                                ? 'text-green-600 hover:text-green-800'
                                : 'text-orange-600 hover:text-orange-800'
                            }`}
                            title={(customer.status || 'active') === 'blocked' ? 'إلغاء الحظر' : 'حظر'}
                          >
                            {(customer.status || 'active') === 'blocked' ? <CheckCircle size={18} /> : <Ban size={18} />}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setWalletData({ amount: '', description: 'شحن رصيد الزبون' });
                              setShowWalletModal(true);
                            }}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="شحن المحفظة"
                          >
                            <Wallet size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowTransactionsModal(true);
                              fetchCustomerTransactions(customer.id);
                            }}
                            className="text-purple-600 hover:text-purple-800 transition-colors"
                            title="المعاملات"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setCustomerToDelete(customer);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCustomerToDelete(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full">
            <Dialog.Title className="text-xl font-bold mb-4 text-red-600">
              تأكيد الحذف
            </Dialog.Title>
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                هل أنت متأكد من حذف الزبون <strong className="text-gray-900">{customerToDelete?.name}</strong>؟
              </p>
              <div className="bg-yellow-50 border-r-4 border-yellow-400 p-3 mb-3">
                <p className="text-sm text-yellow-800">
                  سيتم حذف جميع البيانات المرتبطة بهذا العميل:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 mr-4 list-disc">
                  <li>المحفظة والمعاملات</li>
                  <li>العناوين المحفوظة</li>
                  <li>نقاط الولاء</li>
                  <li>رموز الإحالة</li>
                </ul>
              </div>
              <div className="bg-red-50 border-r-4 border-red-400 p-3">
                <p className="text-sm text-red-600 font-semibold">
                  ملاحظة: إذا كان لدى العميل طلبات مسجلة، لن يتم حذف الحساب ويجب عليك حظره بدلاً من ذلك.
                </p>
              </div>
              <p className="text-sm text-red-500 mt-3 font-semibold">
                هذا الإجراء لا يمكن التراجع عنه!
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCustomerToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                disabled={loading}
              >
                {loading ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Add/Edit Customer Modal */}
      <Dialog
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCustomer(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full">
            <Dialog.Title className="text-2xl font-bold mb-6">
              {editingCustomer ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العنوان
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  {loading ? 'جاري الحفظ...' : (editingCustomer ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Wallet Charge Modal */}
      <Dialog
        open={showWalletModal}
        onClose={() => {
          setShowWalletModal(false);
          setSelectedCustomer(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full">
            <Dialog.Title className="text-2xl font-bold mb-6">
              شحن محفظة الزبون: {selectedCustomer?.name}
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المبلغ (₪) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={walletData.amount}
                  onChange={(e) => setWalletData({ ...walletData, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وصف العملية
                </label>
                <textarea
                  value={walletData.description}
                  onChange={(e) => setWalletData({ ...walletData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows="2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletModal(false);
                    setSelectedCustomer(null);
                    setWalletData({ amount: '', description: 'شحن رصيد الزبون' });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleChargeWallet}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  disabled={chargingWallet || !walletData.amount || parseFloat(walletData.amount) <= 0}
                >
                  {chargingWallet ? 'جاري شحن المحفظة...' : 'شحن المحفظة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Customer Transactions Modal */}
      <Dialog
        open={showTransactionsModal}
        onClose={() => {
          setShowTransactionsModal(false);
          setSelectedCustomer(null);
          setCustomerTransactions([]);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-2xl font-bold mb-6">
              معاملات محفظة الزبون: {selectedCustomer?.name}
            </Dialog.Title>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-1">الرصيد الحالي</h4>
                <p className="text-2xl font-bold text-blue-600">₪{selectedCustomer?.wallet_balance.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1">إجمالي الإيداعات</h4>
                <p className="text-xl font-bold text-green-600">₪{(Number(selectedCustomer?.total_deposits) || 0).toFixed(2)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-800 mb-1">إجمالي السحوبات</h4>
                <p className="text-xl font-bold text-red-600">₪{(Number(selectedCustomer?.total_withdrawals) || 0).toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-1">إجمالي الإنفاق</h4>
                <p className="text-xl font-bold text-purple-600">₪{(Number(selectedCustomer?.total_spent) || 0).toFixed(2)}</p>
              </div>
            </div>

            {loadingTransactions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : customerTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد معاملات في المحفظة
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النوع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerTransactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(transaction.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            transaction.type === 'deposit' ? 'bg-green-100 text-green-800' :
                            transaction.type === 'withdrawal' ? 'bg-red-100 text-red-800' :
                            transaction.type === 'payment' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {transaction.type === 'deposit' ? 'إيداع' :
                             transaction.type === 'withdrawal' ? 'سحب' :
                             transaction.type === 'payment' ? 'دفع' :
                             transaction.type === 'refund' ? 'استرداد' :
                             transaction.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${
                            transaction.type === 'deposit' || transaction.type === 'refund'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.type === 'deposit' || transaction.type === 'refund' ? '+' : '-'}
                            ₪{Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.payment_type === 'admin_adjustment' ? 'تعديل إداري' :
                           transaction.payment_type === 'cash' ? 'نقدي' :
                           transaction.payment_type === 'electronic' ? 'إلكتروني' :
                           transaction.payment_type === 'bank_transfer' ? 'تحويل بنكي' :
                           transaction.payment_type === 'credit_card' ? 'بطاقة ائتمان' :
                           transaction.payment_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transaction.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                            transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            transaction.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {transaction.status === 'completed' ? 'مكتمل' :
                             transaction.status === 'pending' ? 'معلق' :
                             transaction.status === 'failed' ? 'فشل' :
                             transaction.status === 'cancelled' ? 'ملغي' :
                             transaction.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTransactionsModal(false);
                  setSelectedCustomer(null);
                  setCustomerTransactions([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Pending Deposits Modal */}
      <Dialog
        open={showPendingDepositsModal}
        onClose={() => {
          setShowPendingDepositsModal(false);
          setPendingDeposits([]);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-2xl font-bold mb-6">
              طلبات الإيداع المعلقة ({pendingDeposits.length})
            </Dialog.Title>

            {loadingPendingDeposits ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pendingDeposits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد طلبات إيداع معلقة
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العميل</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الطلب</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingDeposits.map(deposit => (
                      <tr key={deposit.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {deposit.wallet?.customer?.name || 'غير معروف'}
                            </div>
                            <div className="text-gray-500">
                              {deposit.wallet?.customer?.phone || 'غير متوفر'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-lg font-bold text-green-600">
                            ₪{Number(deposit.amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {deposit.payment_type === 'cash' ? 'نقدي' :
                             deposit.payment_type === 'electronic' ? 'إلكتروني' :
                             deposit.payment_type === 'bank_transfer' ? 'تحويل بنكي' :
                             deposit.payment_type === 'credit_card' ? 'بطاقة ائتمان' :
                             deposit.payment_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {deposit.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(deposit.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const note = prompt('ملاحظة الموافقة (اختياري):');
                                if (note !== null) {
                                  handleApproveDeposit(deposit.id, 'approve', note);
                                }
                              }}
                              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => {
                                const note = prompt('سبب الرفض (اختياري):');
                                if (note !== null) {
                                  handleApproveDeposit(deposit.id, 'reject', note);
                                }
                              }}
                              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                            >
                              رفض
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowPendingDepositsModal(false);
                  setPendingDeposits([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
