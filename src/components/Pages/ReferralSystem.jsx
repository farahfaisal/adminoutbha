import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ReferralSystem() {
  const { user } = useAuth();
  const [referralCodes, setReferralCodes] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('codes');
  
  // Reward form state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [codeForm, setCodeForm] = useState({
    type: 'user',
    points_reward: 100,
    points_referrer: 50,
    usage_limit: '',
    expires_at: '',
    customer_id: '' // Changed from user_id to customer_id
  });
  
  const [referralForm, setReferralForm] = useState({
    code: '',
    user_id: ''
  });
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all users from custom_users table
      const { data: usersData, error: usersError } = await supabase
        .from('custom_users')
        .select('id, name, email, username, role')
        .order('name');
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        // Continue with partial data
        setUsers([]);
      } else {
        setUsers(usersData || []);
      }
      
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          id, 
          name, 
          phone, 
          email, 
          referral_code,
          user_id,
          auth_user_id
        `)
        .order('name');
      
      if (customersError) {
        console.error('Error fetching customers:', customersError);
        setCustomers([]);
      } else {
        setCustomers(customersData || []);
      }
      
      // Fetch referral codes without join
      const { data: codesData, error: codesError } = await supabase
        .from('referral_codes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (codesError) throw codesError;
      
      // Manually enrich referral codes with customer data
      const enrichedCodes = codesData?.map(code => {
        const customerData = customersData?.find(c => c.id === code.user_id);
        return {
          ...code,
          customer: customerData ? {
            id: customerData.id,
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone
          } : null
        };
      }) || [];
      
      setReferralCodes(enrichedCodes);
      
      // Fetch referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          code:code_id(code, type, points_reward, points_referrer)
        `)
        .order('created_at', { ascending: false });
      
      if (referralsError) throw referralsError;
      
      // Enrich referrals with user data
      const enrichedReferrals = referralsData?.map(referral => {
        const referrer = usersData?.find(u => u.id === referral.referrer_id);
        const referred = usersData?.find(u => u.id === referral.referred_id);
        
        return {
          ...referral,
          referrer_name: referrer?.name || 'Unknown',
          referrer_email: referrer?.email || 'Unknown',
          referred_name: referred?.name || 'Unknown',
          referred_email: referred?.email || 'Unknown'
        };
      }) || [];
      
      setReferrals(enrichedReferrals);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const initialFilters = {
    code: {
      type: 'text',
      label: 'كود الإحالة',
      placeholder: 'البحث بكود الإحالة',
      value: ''
    },
    type: {
      type: 'select',
      label: 'نوع الكود',
      placeholder: 'جميع الأنواع',
      options: [
        { value: 'user', label: 'مستخدم' },
        { value: 'influencer', label: 'مشهور' }
      ],
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'inactive', label: 'غير نشط' },
        { value: 'expired', label: 'منتهي' }
      ],
      value: ''
    }
  };

  const { 
    filters: codesFilters, 
    filterData: filterCodes, 
    handleFilterChange: handleCodesFilterChange 
  } = useFilters(initialFilters);

  const referralsInitialFilters = {
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'pending', label: 'معلق' },
        { value: 'completed', label: 'مكتمل' },
        { value: 'cancelled', label: 'ملغي' }
      ],
      value: ''
    }
  };

  const { 
    filters: referralsFilters, 
    filterData: filterReferrals, 
    handleFilterChange: handleReferralsFilterChange 
  } = useFilters(referralsInitialFilters);

  const handleGenerateCode = async () => {
    try {
      // For admin users, use the selected customer_id if provided
      const targetCustomerId = user?.role === 'admin' && codeForm.customer_id ? codeForm.customer_id : null;
      
      if (!targetCustomerId) {
        toast.error('يرجى تحديد العميل لإنشاء كود الإحالة');
        return;
      }

      // Call the RPC function to create a referral code
      const { data, error } = await supabase.rpc(
        'create_user_referral_code',
        { 
          p_user_id: targetCustomerId, // This now references customers.id
          p_type: codeForm.type,
          p_points_reward: parseInt(codeForm.points_reward),
          p_points_referrer: parseInt(codeForm.points_referrer),
          p_expires_at: codeForm.expires_at ? new Date(codeForm.expires_at).toISOString() : null
        }
      );
      
      if (error) {
        console.error("RPC error:", error);
        toast.error(`فشل في إنشاء كود الإحالة: ${error.message}`);
        return;
      }
      
      if (data.success) {
        toast.success('تم إنشاء كود الإحالة بنجاح');
        fetchData();
        setShowCodeModal(false);
        setCodeForm({
          type: 'user',
          points_reward: 100,
          points_referrer: 50,
          usage_limit: '',
          expires_at: '',
          customer_id: ''
        });
      } else {
        toast.info(data.message);
      }
    } catch (error) {
      console.error('Error generating referral code:', error);
      toast.error('فشل في إنشاء كود الإحالة');
    }
  };

  const handleProcessReferral = async () => {
    try {
      if (!referralForm.code || !referralForm.user_id) {
        toast.error('الرجاء إدخال كود الإحالة واختيار المستخدم');
        return;
      }

      // Call the RPC function to process a referral
      const { data, error } = await supabase.rpc(
        'process_referral',
        {
          p_referral_code: referralForm.code,
          p_referred_id: referralForm.user_id
        }
      );

      if (error) throw error;
      
      if (data.success) {
        toast.success('تم معالجة الإحالة بنجاح');
        fetchData();
        setShowReferralModal(false);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      toast.error('فشل في معالجة الإحالة');
    }
  };

  const handleCompleteReferral = async (referralId) => {
    try {
      // Call the RPC function to complete a referral
      const { data, error } = await supabase.rpc(
        'complete_customer_referral',
        {
          p_referral_id: referralId
        }
      );

      if (error) throw error;
      
      if (data.success) {
        toast.success('تم إكمال الإحالة بنجاح');
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error completing referral:', error);
      toast.error('فشل في إكمال الإحالة');
    }
  };

  const handleCancelReferral = async (referralId) => {
    try {
      // Update referral status to cancelled
      const { error } = await supabase
        .from('referrals')
        .update({ status: 'cancelled' })
        .eq('id', referralId);
      
      if (error) throw error;
      
      toast.success('تم إلغاء الإحالة بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error cancelling referral:', error);
      toast.error('فشل في إلغاء الإحالة');
    }
  };

  const handleDeactivateCode = async (codeId) => {
    try {
      // Update code status to inactive
      const { error } = await supabase
        .from('referral_codes')
        .update({ status: 'inactive' })
        .eq('id', codeId);
      
      if (error) throw error;
      
      toast.success('تم إلغاء تفعيل الكود بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deactivating code:', error);
      toast.error('فشل في إلغاء تفعيل الكود');
    }
  };

  const handleActivateCode = async (codeId) => {
    try {
      // Update code status to active
      const { error } = await supabase
        .from('referral_codes')
        .update({ status: 'active' })
        .eq('id', codeId);
      
      if (error) throw error;
      
      toast.success('تم تفعيل الكود بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error activating code:', error);
      toast.error('فشل في تفعيل الكود');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'expired': return 'منتهي';
      case 'pending': return 'معلق';
      case 'completed': return 'مكتمل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'user': return 'مستخدم';
      case 'influencer': return 'مشهور';
      default: return type;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ar-SA');
  };

  const filteredCodes = filterCodes(referralCodes);
  const filteredReferrals = filterReferrals(referrals);

  // Check if current user is admin
  const isAdmin = user?.role === 'admin';

  // Render rewards tab
  const renderCodesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">قائمة أكواد الإحالة</h3>
        <button
          onClick={() => {
            setEditingReward(null);
            setCodeForm({
              type: 'user',
              points_reward: 100,
              points_referrer: 50,
              usage_limit: '',
              expires_at: '',
              customer_id: ''
            });
            setShowCodeModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          إضافة كود جديد
        </button>
      </div>

      <SearchFilter 
        filters={codesFilters}
        onFilterChange={handleCodesFilterChange}
      />

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg text-red-800">
          <h3 className="font-semibold mb-2">خطأ</h3>
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : filteredCodes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4M12 4v16m8-8a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">لا توجد أكواد إحالة</h3>
          <p className="text-gray-500 mb-6">لم يتم العثور على أي أكواد إحالة متطابقة مع معايير البحث.</p>
          <button
            onClick={() => {
              setEditingReward(null);
              setCodeForm({
                type: 'user',
                points_reward: 100,
                points_referrer: 50,
                usage_limit: '',
                expires_at: '',
                customer_id: ''
              });
              setShowCodeModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة أول كود إحالة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCodes.map(code => (
            <div key={code.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{code.code}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(code.status)}`}>
                    {getStatusText(code.status)}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">العميل:</span>
                    <span className="font-semibold">{code.customer?.name || 'غير معروف'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">البريد الإلكتروني:</span>
                    <span className="font-semibold">{code.customer?.email || 'غير معروف'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">الهاتف:</span>
                    <span className="font-semibold">{code.customer?.phone || 'غير معروف'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">نوع الكود:</span>
                    <span className="font-semibold">{getTypeText(code.type)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">نقاط المستخدم الجديد:</span>
                    <span className="font-semibold">{code.points_reward} نقطة</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">نقاط المُحيل:</span>
                    <span className="font-semibold">{code.points_referrer} نقطة</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">الاستخدام:</span>
                    <span className="font-semibold">
                      {code.usage_limit ? `${code.used_count}/${code.usage_limit}` : `${code.used_count}/∞`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">تاريخ الانتهاء:</span>
                    <span className="font-semibold">
                      {formatDate(code.expires_at)}
                    </span>
                  </div>
                  
                  {code.referral_link && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">رابط الإحالة:</span>
                      <span className="font-semibold text-blue-600 cursor-pointer" 
                        onClick={() => {
                          navigator.clipboard.writeText(code.referral_link);
                          toast.success('تم نسخ رابط الإحالة');
                        }}>
                        نسخ الرابط
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2">
                  {code.status === 'active' ? (
                    <button
                      onClick={() => handleDeactivateCode(code.id)}
                      className="text-red-600 hover:text-red-800 ml-2"
                    >
                      إلغاء التفعيل
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateCode(code.id)}
                      className="text-green-600 hover:text-green-800 ml-2"
                    >
                      تفعيل
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render referrals tab
  const renderReferralsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">الإحالات</h3>
        <button
          onClick={() => {
            setReferralForm({
              code: '',
              user_id: ''
            });
            setShowReferralModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          إضافة إحالة
        </button>
      </div>

      <SearchFilter 
        filters={referralsFilters}
        onFilterChange={handleReferralsFilterChange}
      />

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg text-red-800">
          <h3 className="font-semibold mb-2">خطأ</h3>
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">لا توجد إحالات</h3>
          <p className="text-gray-500 mb-6">لم يتم العثور على أي إحالات متطابقة مع معايير البحث.</p>
          <button
            onClick={() => {
              setReferralForm({
                code: '',
                user_id: ''
              });
              setShowReferralModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة أول إحالة
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المُحيل</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المُحال</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الكود</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النقاط</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإكمال</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReferrals.map(referral => (
                  <tr key={referral.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">{referral.referrer_name}</div>
                        <div className="text-gray-500">{referral.referrer_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">{referral.referred_name}</div>
                        <div className="text-gray-500">{referral.referred_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{referral.code?.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div>المستخدم: {referral.code?.points_reward}</div>
                        <div>المُحيل: {referral.code?.points_referrer}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDate(referral.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDate(referral.completed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(referral.status)}`}>
                        {getStatusText(referral.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {referral.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleCompleteReferral(referral.id)}
                            className="text-blue-600 hover:text-blue-800 ml-2"
                          >
                            إكمال
                          </button>
                          <button
                            onClick={() => handleCancelReferral(referral.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            إلغاء
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">إحصائيات الإحالة</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold mb-4">إجمالي الإحالات</h4>
          <div className="text-3xl font-bold text-blue-600">{referrals.length}</div>
          <div className="mt-2 text-sm text-gray-500">
            <div>مكتملة: {referrals.filter(r => r.status === 'completed').length}</div>
            <div>معلقة: {referrals.filter(r => r.status === 'pending').length}</div>
            <div>ملغية: {referrals.filter(r => r.status === 'cancelled').length}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold mb-4">أكواد الإحالة</h4>
          <div className="text-3xl font-bold text-green-600">{referralCodes.length}</div>
          <div className="mt-2 text-sm text-gray-500">
            <div>نشطة: {referralCodes.filter(c => c.status === 'active').length}</div>
            <div>غير نشطة: {referralCodes.filter(c => c.status === 'inactive').length}</div>
            <div>منتهية: {referralCodes.filter(c => c.status === 'expired').length}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold mb-4">النقاط الممنوحة</h4>
          <div className="text-3xl font-bold text-purple-600">
            {referrals
              .filter(r => r.status === 'completed')
              .reduce((total, r) => {
                const rewardPoints = r.code?.points_reward || 0;
                const referrerPoints = r.code?.points_referrer || 0;
                return total + rewardPoints + referrerPoints;
              }, 0)}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <div>للمستخدمين المُحالين: {referrals
              .filter(r => r.status === 'completed')
              .reduce((total, r) => total + (r.code?.points_reward || 0), 0)}</div>
            <div>للمُحيلين: {referrals
              .filter(r => r.status === 'completed')
              .reduce((total, r) => total + (r.code?.points_referrer || 0), 0)}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="text-lg font-semibold mb-4">أفضل المُحيلين</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد الإحالات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإحالات المكتملة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النقاط المكتسبة</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users
                .map(user => {
                  const userReferrals = referrals.filter(r => r.referrer_id === user.id);
                  const completedReferrals = userReferrals.filter(r => r.status === 'completed');
                  const pointsEarned = completedReferrals.reduce((total, r) => total + (r.code?.points_referrer || 0), 0);
                  
                  return {
                    user,
                    totalReferrals: userReferrals.length,
                    completedReferrals: completedReferrals.length,
                    pointsEarned
                  };
                })
                .filter(item => item.totalReferrals > 0)
                .sort((a, b) => b.pointsEarned - a.pointsEarned)
                .slice(0, 5)
                .map(item => (
                  <tr key={item.user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">{item.user.name}</div>
                        <div className="text-gray-500">{item.user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.totalReferrals}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.completedReferrals}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.pointsEarned}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">نظام الإحالة</h2>
      
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('codes')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'codes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              أكواد الإحالة
            </button>
            <button
              onClick={() => setActiveTab('referrals')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'referrals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              الإحالات
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              الإحصائيات
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'codes' && renderCodesTab()}
          {activeTab === 'referrals' && renderReferralsTab()}
          {activeTab === 'stats' && renderStatsTab()}
        </div>
      </div>

      {/* Code Modal */}
      <Dialog
        open={showCodeModal}
        onClose={() => {
          setShowCodeModal(false);
          setEditingReward(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              إنشاء كود إحالة جديد
            </Dialog.Title>

            <form className="space-y-4">
              {/* Customer selection field for admins */}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العميل <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={codeForm.customer_id}
                    onChange={(e) => setCodeForm({ ...codeForm, customer_id: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">اختر العميل</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email || customer.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الكود
                </label>
                <select
                  value={codeForm.type}
                  onChange={(e) => setCodeForm({ ...codeForm, type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="user">مستخدم</option>
                  <option value="influencer">مشهور</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نقاط المستخدم الجديد
                </label>
                <input
                  type="number"
                  value={codeForm.points_reward}
                  onChange={(e) => setCodeForm({ ...codeForm, points_reward: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نقاط المُحيل
                </label>
                <input
                  type="number"
                  value={codeForm.points_referrer}
                  onChange={(e) => setCodeForm({ ...codeForm, points_referrer: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأقصى للاستخدام
                </label>
                <input
                  type="number"
                  value={codeForm.usage_limit}
                  onChange={(e) => setCodeForm({ ...codeForm, usage_limit: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  placeholder="اتركه فارغاً لعدم وجود حد"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الانتهاء
                </label>
                <input
                  type="date"
                  value={codeForm.expires_at}
                  onChange={(e) => setCodeForm({ ...codeForm, expires_at: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="اتركه فارغاً لعدم وجود تاريخ انتهاء"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  إنشاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Referral Modal */}
      <Dialog
        open={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              إضافة إحالة جديدة
            </Dialog.Title>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كود الإحالة
                </label>
                <input
                  type="text"
                  value={referralForm.code}
                  onChange={(e) => setReferralForm({ ...referralForm, code: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="أدخل كود الإحالة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستخدم المُحال
                </label>
                <select
                  value={referralForm.user_id}
                  onChange={(e) => setReferralForm({ ...referralForm, user_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">اختر المستخدم</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email || user.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleProcessReferral}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Help Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">كيفية عمل نظام الإحالة</h3>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">إنشاء أكواد الإحالة</h4>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>يمكن للمسؤولين إنشاء أكواد إحالة للعملاء</li>
              <li>يمكن تحديد نوع الكود (مستخدم عادي أو مشهور)</li>
              <li>يمكن تحديد عدد النقاط التي سيحصل عليها المستخدم الجديد والمُحيل</li>
              <li>يمكن تحديد حد أقصى لاستخدام الكود وتاريخ انتهاء</li>
              <li>يتم ربط كل كود إحالة بعميل محدد في جدول العملاء</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">استخدام أكواد الإحالة</h4>
            <ul className="list-disc list-inside space-y-1 text-green-700">
              <li>يمكن للعملاء مشاركة أكواد الإحالة الخاصة بهم مع أصدقائهم</li>
              <li>رابط الإحالة: <code className="bg-white px-2 py-1 rounded">https://ben-edek.com/signup?ref=CODE</code></li>
              <li>عندما يستخدم مستخدم جديد كود الإحالة، يتم إنشاء سجل إحالة</li>
              <li>يمكن للمسؤولين إكمال الإحالة أو إلغائها</li>
              <li>عند إكمال الإحالة، يحصل كل من المستخدم الجديد والمُحيل على نقاط</li>
            </ul>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-800 mb-2">إدارة المكافآت</h4>
            <ul className="list-disc list-inside space-y-1 text-purple-700">
              <li>يمكن للمسؤولين إنشاء وتعديل وحذف المكافآت</li>
              <li>يمكن تحديد فترة صلاحية للمكافآت</li>
              <li>يمكن تحديد حد أقصى لاستخدام كل مكافأة</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">ملاحظة مهمة</h4>
            <p className="text-yellow-700">
              يجب اختيار عميل من قائمة العملاء المسجلين لإنشاء كود إحالة. تأكد من أن العميل مسجل في النظام قبل إنشاء كود الإحالة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}