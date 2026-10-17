import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { supabase } from '../../lib/supabase';
import { addPointsToCustomer } from '../../lib/pointsApi';

export default function PointsRewards() {
  const [rewards, setRewards] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('rewards');
  
  // Reward form state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    points_cost: '',
    reward_type: 'order_discount',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount: '',
    usage_limit: '',
    start_date: '',
    end_date: '',
    status: 'active'
  });
  
  // Points adjustment form state
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [pointsForm, setPointsForm] = useState({
    points: '',
    type: 'earn',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('points_rewards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);
      
      // Fetch customers with points
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          email,
          points_accounts(id, balance, total_earned, total_spent, last_activity)
        `)
        .order('name');
      
      if (customersError) throw customersError;
      
      // Transform data for easier use
      const transformedCustomers = customersData?.map(customer => {
        const pointsAccount = customer.points_accounts && customer.points_accounts.length > 0 
          ? customer.points_accounts[0] 
          : { id: null, balance: 0, total_earned: 0, total_spent: 0, last_activity: null };
        
        return {
          id: pointsAccount.id || null,
          customer_id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email || '',
          balance: pointsAccount.balance || 0,
          total_earned: pointsAccount.total_earned || 0,
          total_spent: pointsAccount.total_spent || 0,
          last_activity: pointsAccount.last_activity
        };
      }) || [];
      
      setCustomers(transformedCustomers);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const initialFilters = {
    name: {
      type: 'text',
      label: 'اسم المكافأة',
      placeholder: 'البحث باسم المكافأة',
      value: ''
    },
    reward_type: {
      type: 'select',
      label: 'نوع المكافأة',
      placeholder: 'جميع الأنواع',
      options: [
        { value: 'order_discount', label: 'خصم على الطلب' },
        { value: 'free_delivery', label: 'توصيل مجاني' },
        { value: 'product_discount', label: 'خصم على منتج' },
        { value: 'gift', label: 'هدية' }
      ],
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
    }
  };

  const { 
    filters: rewardsFilters, 
    filterData: filterRewards, 
    handleFilterChange: handleRewardsFilterChange 
  } = useFilters(initialFilters);

  const customersInitialFilters = {
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
    balance: {
      type: 'number',
      label: 'الرصيد',
      placeholder: 'الحد الأدنى للرصيد',
      min: 0,
      value: ''
    }
  };

  const { 
    filters: customersFilters, 
    filterData: filterCustomers, 
    handleFilterChange: handleCustomersFilterChange 
  } = useFilters(customersInitialFilters);

  const handleRewardSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate required fields
      if (!rewardForm.name || !rewardForm.points_cost || !rewardForm.reward_type || 
          !rewardForm.start_date || !rewardForm.end_date) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        setLoading(false);
        return;
      }
      
      // Validate dates
      const startDate = new Date(rewardForm.start_date);
      const endDate = new Date(rewardForm.end_date);
      
      if (startDate > endDate) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        setLoading(false);
        return;
      }
      
      // Prepare data for submission
      const rewardData = {
        name: rewardForm.name,
        description: rewardForm.description,
        points_cost: parseInt(rewardForm.points_cost),
        reward_type: rewardForm.reward_type,
        status: rewardForm.status,
        start_date: rewardForm.start_date,
        end_date: rewardForm.end_date,
        usage_limit: rewardForm.usage_limit ? parseInt(rewardForm.usage_limit) : null
      };
      
      // Add discount-specific fields if applicable
      if (['order_discount', 'delivery_discount', 'product_discount'].includes(rewardForm.reward_type)) {
        rewardData.discount_type = rewardForm.discount_type;
        rewardData.discount_value = parseFloat(rewardForm.discount_value);
        
        if (rewardForm.min_order_amount) {
          rewardData.min_order_amount = parseFloat(rewardForm.min_order_amount);
        }
        
        if (rewardForm.max_discount) {
          rewardData.max_discount = parseFloat(rewardForm.max_discount);
        }
      }
      
      if (editingReward) {
        // Update existing reward
        const { error } = await supabase
          .from('points_rewards')
          .update(rewardData)
          .eq('id', editingReward.id);
        
        if (error) throw error;
        toast.success('تم تحديث المكافأة بنجاح');
      } else {
        // Create new reward
        const { error } = await supabase
          .from('points_rewards')
          .insert([rewardData]);
        
        if (error) throw error;
        toast.success('تم إضافة المكافأة بنجاح');
      }
      
      // Reset form and close modal
      setRewardForm({
        name: '',
        description: '',
        points_cost: '',
        reward_type: 'order_discount',
        discount_type: 'percentage',
        discount_value: '',
        min_order_amount: '',
        max_discount: '',
        usage_limit: '',
        start_date: '',
        end_date: '',
        status: 'active'
      });
      setShowRewardModal(false);
      setEditingReward(null);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error saving reward:', error);
      toast.error('فشل في حفظ المكافأة');
    } finally {
      setLoading(false);
    }
  };

  // Points adjustment handling
  const handlePointsSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate required fields
      if (!selectedCustomer || !pointsForm.points || !pointsForm.type) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        setLoading(false);
        return;
      }
      
      // Calculate points to add or subtract
      const pointsValue = pointsForm.type === 'earn' 
        ? parseInt(pointsForm.points) 
        : -parseInt(pointsForm.points);
      
      // Add points to customer
      const result = await addPointsToCustomer(
        selectedCustomer.customer_id,
        pointsValue,
        pointsForm.description || (pointsForm.type === 'earn' ? 'إضافة نقاط يدوية' : 'خصم نقاط يدوي')
      );
      
      if (!result.success) {
        throw new Error(result.message || 'فشل في تعديل النقاط');
      }
      
      toast.success(`تم ${pointsForm.type === 'earn' ? 'إضافة' : 'خصم'} النقاط بنجاح`);
      
      // Reset form and close modal
      setPointsForm({
        points: '',
        type: 'earn',
        description: ''
      });
      setShowPointsModal(false);
      setSelectedCustomer(null);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast.error('فشل في تعديل النقاط');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المكافأة؟')) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('points_rewards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('تم حذف المكافأة بنجاح');
      
      // Update local state
      setRewards(rewards.filter(reward => reward.id !== id));
    } catch (error) {
      console.error('Error deleting reward:', error);
      toast.error('فشل في حذف المكافأة');
    } finally {
      setLoading(false);
    }
  };

  // Reward type options
  const rewardTypes = [
    { value: 'order_discount', label: 'خصم على الطلب' },
    { value: 'delivery_discount', label: 'خصم على التوصيل' },
    { value: 'free_delivery', label: 'توصيل مجاني' },
    { value: 'product_discount', label: 'خصم على منتج' },
    { value: 'gift', label: 'هدية' }
  ];

  // Discount type options
  const discountTypes = [
    { value: 'percentage', label: 'نسبة مئوية' },
    { value: 'fixed', label: 'مبلغ ثابت' }
  ];

  // Status options
  const statusOptions = [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'غير نشط' }
  ];

  // Points transaction type options
  const pointsTypes = [
    { value: 'earn', label: 'إضافة نقاط' },
    { value: 'spend', label: 'خصم نقاط' },
    { value: 'adjust', label: 'تعديل الرصيد' }
  ];

  const filteredRewards = filterRewards(rewards);
  const filteredCustomers = filterCustomers(customers);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      default: return status;
    }
  };

  const getRewardTypeText = (type) => {
    const rewardType = rewardTypes.find(rt => rt.value === type);
    return rewardType ? rewardType.label : type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ar-SA');
  };

  // Render rewards tab
  const renderRewardsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">قائمة المكافآت</h3>
        <button
          onClick={() => {
            setEditingReward(null);
            setRewardForm({
              name: '',
              description: '',
              points_cost: '',
              reward_type: 'order_discount',
              discount_type: 'percentage',
              discount_value: '',
              min_order_amount: '',
              max_discount: '',
              usage_limit: '',
              start_date: '',
              end_date: '',
              status: 'active'
            });
            setShowRewardModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          إضافة مكافأة جديدة
        </button>
      </div>

      <SearchFilter 
        filters={rewardsFilters}
        onFilterChange={handleRewardsFilterChange}
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
      ) : filteredRewards.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4M12 4v16m8-8a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">لا توجد مكافآت</h3>
          <p className="text-gray-500 mb-6">لم يتم العثور على أي مكافآت متطابقة مع معايير البحث.</p>
          <button
            onClick={() => {
              setEditingReward(null);
              setRewardForm({
                name: '',
                description: '',
                points_cost: '',
                reward_type: 'order_discount',
                discount_type: 'percentage',
                discount_value: '',
                min_order_amount: '',
                max_discount: '',
                usage_limit: '',
                start_date: '',
                end_date: '',
                status: 'active'
              });
              setShowRewardModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة أول مكافأة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRewards.map(reward => (
            <div key={reward.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{reward.name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(reward.status)}`}>
                    {getStatusText(reward.status)}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{reward.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">النقاط المطلوبة:</span>
                    <span className="font-semibold">{reward.points_cost} نقطة</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">نوع المكافأة:</span>
                    <span className="font-semibold">{getRewardTypeText(reward.reward_type)}</span>
                  </div>
                  
                  {reward.discount_type && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">نوع الخصم:</span>
                      <span className="font-semibold">
                        {reward.discount_type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                      </span>
                    </div>
                  )}
                  
                  {reward.discount_value && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">قيمة الخصم:</span>
                      <span className="font-semibold">
                        {reward.discount_type === 'percentage' ? `${reward.discount_value}%` : `₪${reward.discount_value}`}
                      </span>
                    </div>
                  )}
                  
                  {reward.min_order_amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">الحد الأدنى للطلب:</span>
                      <span className="font-semibold">₪{reward.min_order_amount}</span>
                    </div>
                  )}
                  
                  {reward.max_discount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">أقصى خصم:</span>
                      <span className="font-semibold">₪{reward.max_discount}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">الصلاحية:</span>
                    <span className="font-semibold">
                      {formatDate(reward.start_date)} - {formatDate(reward.end_date)}
                    </span>
                  </div>
                  
                  {reward.usage_limit && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">حد الاستخدام:</span>
                      <span className="font-semibold">{reward.used_count || 0}/{reward.usage_limit}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditingReward(reward);
                      setRewardForm({
                        name: reward.name,
                        description: reward.description || '',
                        points_cost: reward.points_cost.toString(),
                        reward_type: reward.reward_type,
                        discount_type: reward.discount_type || 'percentage',
                        discount_value: reward.discount_value?.toString() || '',
                        min_order_amount: reward.min_order_amount?.toString() || '',
                        max_discount: reward.max_discount?.toString() || '',
                        usage_limit: reward.usage_limit?.toString() || '',
                        start_date: reward.start_date,
                        end_date: reward.end_date,
                        status: reward.status
                      });
                      setShowRewardModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 ml-2"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(reward.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render customers tab
  const renderCustomersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">نقاط العملاء</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setPointsForm({
                points: '',
                type: 'earn',
                description: ''
              });
              setShowPointsModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            disabled={customers.length === 0}
          >
            إضافة نقاط
          </button>
        </div>
      </div>

      <SearchFilter 
        filters={customersFilters}
        onFilterChange={handleCustomersFilterChange}
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
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">لا يوجد عملاء</h3>
          <p className="text-gray-500 mb-6">لم يتم العثور على أي عملاء لديهم نقاط.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العميل</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رصيد النقاط</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي المكتسب</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي المستخدم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">آخر نشاط</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <tr key={customer.customer_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                      {customer.email && <div className="text-sm text-gray-500">{customer.email}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-lg font-bold text-blue-600">{customer.balance}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.total_earned}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.total_spent}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.last_activity ? formatDate(customer.last_activity) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setPointsForm({
                            points: '',
                            type: 'earn',
                            description: ''
                          });
                          setShowPointsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        تعديل النقاط
                      </button>
                      <button
                        onClick={() => {
                          // View transactions
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        السجل
                      </button>
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">نظام النقاط والمكافآت</h2>
      
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('rewards')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'rewards'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              المكافآت
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'customers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              نقاط العملاء
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'rewards' && renderRewardsTab()}
          {activeTab === 'customers' && renderCustomersTab()}
        </div>
      </div>

      {/* Reward Modal */}
      <Dialog
        open={showRewardModal}
        onClose={() => {
          setShowRewardModal(false);
          setEditingReward(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              {editingReward ? 'تعديل مكافأة' : 'إضافة مكافأة جديدة'}
            </Dialog.Title>

            <form onSubmit={handleRewardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم المكافأة <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={rewardForm.name}
                    onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الوصف
                  </label>
                  <textarea
                    value={rewardForm.description}
                    onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    النقاط المطلوبة <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={rewardForm.points_cost}
                    onChange={(e) => setRewardForm({ ...rewardForm, points_cost: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع المكافأة <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={rewardForm.reward_type}
                    onChange={(e) => setRewardForm({ ...rewardForm, reward_type: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    {rewardTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {['order_discount', 'delivery_discount', 'product_discount'].includes(rewardForm.reward_type) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        نوع الخصم <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={rewardForm.discount_type}
                        onChange={(e) => setRewardForm({ ...rewardForm, discount_type: e.target.value })}
                        className="w-full border rounded-md px-3 py-2"
                        required
                      >
                        {discountTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        قيمة الخصم <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={rewardForm.discount_value}
                          onChange={(e) => setRewardForm({ ...rewardForm, discount_value: e.target.value })}
                          className="w-full border rounded-md px-3 py-2"
                          min="0"
                          step={rewardForm.discount_type === 'percentage' ? "1" : "0.01"}
                          required
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          {rewardForm.discount_type === 'percentage' ? '%' : '₪'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحد الأدنى للطلب (₪)
                      </label>
                      <input
                        type="number"
                        value={rewardForm.min_order_amount}
                        onChange={(e) => setRewardForm({ ...rewardForm, min_order_amount: e.target.value })}
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {rewardForm.discount_type === 'percentage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          أقصى خصم (₪)
                        </label>
                        <input
                          type="number"
                          value={rewardForm.max_discount}
                          onChange={(e) => setRewardForm({ ...rewardForm, max_discount: e.target.value })}
                          className="w-full border rounded-md px-3 py-2"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حد الاستخدام
                  </label>
                  <input
                    type="number"
                    value={rewardForm.usage_limit}
                    onChange={(e) => setRewardForm({ ...rewardForm, usage_limit: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    placeholder="غير محدود"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحالة <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={rewardForm.status}
                    onChange={(e) => setRewardForm({ ...rewardForm, status: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ البداية <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={rewardForm.start_date}
                    onChange={(e) => setRewardForm({ ...rewardForm, start_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ النهاية <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={rewardForm.end_date}
                    onChange={(e) => setRewardForm({ ...rewardForm, end_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRewardModal(false);
                    setEditingReward(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'جاري الحفظ...' : (editingReward ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Points Adjustment Modal */}
      <Dialog
        open={showPointsModal}
        onClose={() => {
          setShowPointsModal(false);
          setSelectedCustomer(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              تعديل نقاط العميل
            </Dialog.Title>

            {selectedCustomer ? (
              <form onSubmit={handlePointsSubmit} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold text-blue-800">معلومات العميل</h3>
                  <p className="text-blue-700">الاسم: {selectedCustomer.name}</p>
                  <p className="text-blue-700">الرصيد الحالي: {selectedCustomer.balance} نقطة</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع العملية <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={pointsForm.type}
                    onChange={(e) => setPointsForm({ ...pointsForm, type: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    {pointsTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عدد النقاط <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={pointsForm.points}
                    onChange={(e) => setPointsForm({ ...pointsForm, points: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الوصف
                  </label>
                  <textarea
                    value={pointsForm.description}
                    onChange={(e) => setPointsForm({ ...pointsForm, description: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                    placeholder="سبب إضافة/خصم النقاط"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPointsModal(false);
                      setSelectedCustomer(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'جاري الحفظ...' : 'تأكيد'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold text-blue-800">اختر عميل</h3>
                  <p className="text-blue-700">الرجاء اختيار عميل من القائمة أدناه:</p>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {customers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      لا يوجد عملاء
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {customers.map(customer => (
                        <li 
                          key={customer.customer_id} 
                          className="p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-gray-500">{customer.phone}</p>
                            </div>
                            <div className="text-blue-600 font-bold">
                              {customer.balance} نقطة
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    onClick={() => setShowPointsModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Help Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">كيفية عمل نظام النقاط والمكافآت</h3>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">كسب النقاط</h4>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>يكسب العملاء نقطة واحدة مقابل كل 10 شيكل من قيمة الطلب</li>
              <li>يتم إضافة النقاط تلقائيًا عند إكمال الطلب وتغيير حالته إلى "مكتمل"</li>
              <li>يمكن للمسؤولين إضافة نقاط يدويًا للعملاء</li>
              <li>يمكن كسب نقاط إضافية من خلال برامج الإحالة والعروض الخاصة</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">استبدال النقاط</h4>
            <ul className="list-disc list-inside space-y-1 text-green-700">
              <li>يمكن للعملاء استبدال نقاطهم بمكافآت متنوعة</li>
              <li>تشمل المكافآت خصومات على الطلبات، توصيل مجاني، وهدايا</li>
              <li>يتم خصم النقاط تلقائيًا عند استخدام المكافأة</li>
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
        </div>
      </div>
    </div>
  );
}