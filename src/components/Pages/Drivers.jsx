import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import SearchFilter from '../SearchFilter';
import { getRatingsByType } from '../../lib/ratingsApi';
import DriverTrips from './DriverTrips';
import useFilters from '../../hooks/useFilters';
import { useAuth } from '../../contexts/AuthContext';
import { RatingStars } from '../Rating';
import { chargeDriverWallet } from '../../lib/walletApi';

export default function Drivers() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [driverRatings, setDriverRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'offline',
    vehicle_type: 'motorcycle',
    vehicle_plate: '',
    service_area_id: ''
  });
  const [serviceAreas, setServiceAreas] = useState([]);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Wallet charge states
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletData, setWalletData] = useState({
    amount: '',
    description: 'شحن رصيد السائق'
  });
  const [chargingWallet, setChargingWallet] = useState(false);

  // قائمة المناطق المتاحة
  const areas = [
    'رام الله', 'البيرة', 'نابلس', 'جنين', 'طولكرم', 'قلقيلية', 'طوباس', 'سلفيت', 'أريحا', 'بيت لحم', 'الخليل',
    'بيت جالا', 'بيت ساحور', 'بيرزيت', 'الظاهرية', 'دورا', 'يطا', 'عنبتا', 'بيت فجار', 'بديا', 'عزون'
  ];

  useEffect(() => {
    fetchDrivers();
    fetchDriverRatings();
    fetchServiceAreas();
  }, []);

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setServiceAreas(data || []);
    } catch (error) {
      console.error('Error fetching service areas:', error);
    }
  };

  const fetchDriverRatings = async () => {
    try {
      const ratings = await getRatingsByType('driver');
      
      // Group ratings by driver ID
      const ratingsByDriver = {};
      ratings.forEach(rating => {
        if (!ratingsByDriver[rating.to_id]) {
          ratingsByDriver[rating.to_id] = [];
        }
        ratingsByDriver[rating.to_id].push(rating);
      });
      
      setDriverRatings(ratingsByDriver);
    } catch (error) {
      console.error('Error fetching driver ratings:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // جلب بيانات السائقين من جدول custom_users أولاً للحصول على جميع المستخدمين من نوع سائق
      const { data: driverUsers, error: userError } = await supabase
        .from('custom_users')
        .select('id, name, email, username')
        .eq('role', 'driver');
      
      if (userError) throw userError;
      
      // جلب بيانات السائقين من جدول drivers (excluding password column)
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          id,
          user_id,
          name,
          phone,
          email,
          status,
          rating,
          rating_count,
          vehicle_type,
          vehicle_number,
          license_number,
          national_id,
          profile_image,
          is_active,
          is_available,
          service_area_id,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // جلب بيانات محافظ السائقين
      const { data: walletsData, error: walletsError } = await supabase
        .from('driver_wallets')
        .select('*');
        
      if (walletsError) {
        console.error('Error fetching driver wallets:', walletsError);
      }
      
      // دمج البيانات من الجدولين
      let allDrivers = [];
      
      // إضافة السائقين من جدول drivers
      if (data && data.length > 0) {
        allDrivers = [...data].map(driver => {
          // Find wallet for this driver
          const wallet = walletsData?.find(w => w.driver_id === driver.id) || { 
            balance: 0, 
            total_earnings: 0, 
            total_withdrawals: 0 
          };
          
          return {
            ...driver,
            wallet_balance: parseFloat(wallet.balance) || 0,
            wallet_enabled: true, // Drivers always have wallets enabled
            total_orders: 0, // Will be updated later if needed
            total_sales: wallet.total_earnings || 0
          };
        });
      }
      
      // إضافة المستخدمين من نوع سائق الذين ليس لهم سجل في جدول drivers
      if (driverUsers && driverUsers.length > 0) {
        for (const driverUser of driverUsers) {
          // التحقق مما إذا كان المستخدم موجودًا بالفعل في قائمة السائقين
          const existingDriver = allDrivers.find(d => d.user_id === driverUser.id);
          
          if (!existingDriver) {
            // إضافة المستخدم كسائق جديد
            allDrivers.push({
              id: driverUser.id, // استخدام معرف المستخدم كمعرف مؤقت للسائق
              user_id: driverUser.id,
              name: driverUser.name,
              phone: '-',
              email: driverUser.email,
              status: 'offline',
              rating: 5,
              rating_count: 0,
              vehicle_type: 'غير محدد',
              created_at: new Date().toISOString(),
              wallet_balance: 0,
              wallet_enabled: true,
              total_orders: 0,
              total_sales: 0,
              _isFromUserTable: true // علامة لتمييز السائقين الذين تم إنشاؤهم من جدول المستخدمين
            });
          }
        }
      }
      
      setDrivers(allDrivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setError('فشل في تحميل بيانات السائقين. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل بيانات السائقين');
      
      // بيانات تجريبية في حالة الفشل
      setDrivers([
        {
          id: 1,
          name: 'خالد أحمد',
          phone: '0599123456',
          email: 'khaled@example.com',
          status: 'active',
          rating: 4.8,
          rating_count: 156,
          total_orders: 230,
          completed_orders: 220,
          cancelled_orders: 10,
          commission_rate: 15,
          wallet_balance: 450,
          wallet_enabled: true,
          vehicle: {
            type: 'motorcycle',
            model: 'هوندا',
            year: '2022',
            plate_number: '1234-H'
          },
          working_areas: ['رام الله', 'البيرة', 'نابلس']
        },
        {
          id: 2,
          name: 'محمد علي',
          phone: '0599234567',
          email: 'mohammad@example.com',
          status: 'active',
          rating: 4.5,
          rating_count: 98,
          total_orders: 180,
          completed_orders: 170,
          cancelled_orders: 10,
          commission_rate: 15,
          wallet_balance: 320,
          wallet_enabled: true,
          vehicle: {
            type: 'car',
            model: 'تويوتا',
            year: '2020',
            plate_number: '5678-T'
          },
          working_areas: ['جنين', 'طولكرم', 'قلقيلية']
        },
        {
          id: 3,
          name: 'أحمد محمود',
          phone: '0599345678',
          email: 'ahmad@example.com',
          status: 'inactive',
          rating: 4.2,
          rating_count: 75,
          total_orders: 120,
          completed_orders: 110,
          cancelled_orders: 10,
          commission_rate: 15,
          wallet_balance: 200,
          wallet_enabled: true,
          vehicle: {
            type: 'motorcycle',
            model: 'سوزوكي',
            year: '2021',
            plate_number: '9012-S'
          },
          working_areas: ['بيت لحم', 'الخليل']
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const initialFilters = {
    name: {
      type: 'text',
      label: 'اسم السائق',
      placeholder: 'البحث باسم السائق',
      value: ''
    },
    phone: {
      type: 'text',
      label: 'رقم الهاتف',
      placeholder: 'البحث برقم الهاتف',
      value: ''
    },
    status: {
      type: 'select',
      label: 'الحالة',
      placeholder: 'جميع الحالات',
      options: [
        { value: 'offline', label: 'غير متصل' },
        { value: 'available', label: 'متاح' },
        { value: 'busy', label: 'مشغول' }
      ],
      value: ''
    },
    vehicle_type: {
      type: 'select',
      label: 'نوع المركبة',
      placeholder: 'جميع الأنواع',
      options: [
        { value: 'motorcycle', label: 'دراجة نارية' },
        { value: 'car', label: 'سيارة' },
        { value: 'bicycle', label: 'دراجة هوائية' }
      ],
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // التحقق من البيانات المطلوبة
      if (!formData.name || !formData.phone) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        return;
      }

      if (editingDriver) {
        // Update existing driver (excluding password field)
        const { error } = await supabase
          .from('drivers')
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            status: formData.status,
            vehicle_type: formData.vehicle_type,
            vehicle_number: formData.vehicle_plate || null,
            service_area_id: formData.service_area_id || null
          })
          .eq('id', editingDriver.id);
        
        if (error) throw error;
        toast.success('تم تحديث السائق بنجاح');
      } else {
        // Add new driver (with default password)
        const { error } = await supabase
          .from('drivers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            status: formData.status,
            vehicle_type: formData.vehicle_type,
            vehicle_number: formData.vehicle_plate || null,
            service_area_id: formData.service_area_id || null,
            password: 'password123'
          }]);
        
        if (error) throw error;
        toast.success('تم إضافة السائق بنجاح');
      }

      // Refresh drivers list
      fetchDrivers();
      
      // Reset form and close modal
      setShowModal(false);
      setEditingDriver(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        status: 'offline',
        vehicle_type: 'motorcycle',
        vehicle_plate: '',
        service_area_id: ''
      });
    } catch (error) {
      console.error('Error saving driver:', error);
      toast.error(editingDriver ? 'فشل في تحديث السائق' : 'فشل في إضافة السائق');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle changing driver password
  const handleChangePassword = async () => {
    if (!selectedDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error('كلمتي المرور غير متطابقتين');
      return;
    }

    if (passwordData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      setChangingPassword(true);
      
      // First try to update the password in the drivers table
      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          password: passwordData.password
        })
        .eq('id', selectedDriver.id);
      
      if (driverError) {
        console.error('Error updating driver password:', driverError);
        throw new Error('فشل في تحديث كلمة المرور في جدول السائقين');
      }
      
      // Then update the password in the custom_users table
      if (selectedDriver.user_id) {
        const { error: userError } = await supabase.rpc(
          'change_custom_user_password',
          { 
            p_user_id: selectedDriver.user_id,
            p_new_password: passwordData.password
          }
        );
        
        if (userError) {
          console.error('Error updating custom user password:', userError);
          throw new Error('فشل في تحديث كلمة المرور في جدول المستخدمين');
        }
      }
      
      toast.success('تم تحديث كلمة المرور بنجاح');
      
      // Reset form and close modal
      setPasswordData({
        password: '',
        confirmPassword: ''
      });
      setShowPasswordModal(false);
      setSelectedDriver(null);
      
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'فشل في تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
    }
  };

  // Function to handle charging driver wallet
  const handleChargeWallet = async () => {
    if (!selectedDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }

    if (!walletData.amount || parseFloat(walletData.amount) <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    try {
      setChargingWallet(true);
      console.log("Charging driver wallet:", selectedDriver.id, parseFloat(walletData.amount));

      // Call the chargeDriverWallet function from walletApi
      const result = await chargeDriverWallet(
        selectedDriver.id,
        parseFloat(walletData.amount),
        walletData.description || 'شحن رصيد السائق'
      );

      console.log("Charge result:", result);

      if (!result || !result.success) {
        throw new Error(result?.message || 'فشل في شحن محفظة السائق');
      }

      toast.success(`تم شحن محفظة السائق ${selectedDriver.name} بمبلغ ${walletData.amount} شيكل بنجاح`);

      // Reset form and close modal
      setWalletData({
        amount: '',
        description: 'شحن رصيد السائق'
      });
      setShowWalletModal(false);
      setSelectedDriver(null);

      // Refresh drivers list
      fetchDrivers();

    } catch (error) {
      console.error('Error charging wallet:', error);
      toast.error(error.message || 'فشل في شحن محفظة السائق');
    } finally {
      setChargingWallet(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السائق؟')) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('تم حذف السائق بنجاح');
      fetchDrivers();
    } catch (error) {
      console.error('Error deleting driver:', error);
      toast.error('فشل في حذف السائق');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'available': return 'متاح';
      case 'busy': return 'مشغول';
      case 'offline': return 'غير متصل';
      default: return status;
    }
  };

  const getVehicleTypeText = (type) => {
    switch (type) {
      case 'motorcycle': return 'دراجة نارية';
      case 'car': return 'سيارة';
      case 'bicycle': return 'دراجة هوائية';
      default: return type;
    }
  };

  const filteredDrivers = filterData(drivers);

  if (loading && drivers.length === 0) {
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
          onClick={fetchDrivers}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">السائقين</h2>
        <button
          onClick={() => {
            setEditingDriver(null);
            setFormData({
              name: '',
              phone: '',
              email: '',
              status: 'offline',
              vehicle_type: 'motorcycle',
              vehicle_plate: '',
              service_area_id: ''
            });
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          إضافة سائق جديد
        </button>
      </div>

      <SearchFilter 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السائق</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التقييم</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الطلبات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العمولة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المركبة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">منطقة الخدمة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    لا يوجد سائقين متطابقين مع معايير البحث
                  </td>
                </tr>
              ) : (
                filteredDrivers.map(driver => (
                  <tr key={driver.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{driver.name}</div>
                        <div className="text-sm text-gray-500">
                          <div>{driver.phone}</div>
                          <div>{driver.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <RatingStars rating={driver.rating} size="sm" />
                        <span className="text-xs text-gray-500 mt-1">
                          {driverRatings[driver.id] ? `(${driverRatings[driver.id].length} تقييم)` : `(${driver.rating_count || 0} تقييم)`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm">الكل: {driver.total_orders || 0}</div>
                        <div className="text-sm text-green-600">مكتمل: {driver.completed_orders || 0}</div>
                        <div className="text-sm text-red-600">ملغي: {driver.cancelled_orders || 0}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-500">
                          الرصيد: ₪{driver.wallet_balance || 0}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium">
                          {getVehicleTypeText(driver.vehicle_type)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {driver.vehicle_number || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {driver.service_area_id ? (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {serviceAreas.find(a => a.id === driver.service_area_id)?.name || 'غير معروف'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">الكل</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(driver.status)}`}>
                        {getStatusText(driver.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setShowTripsModal(true);
                        }}
                        className="text-green-600 hover:text-green-800 ml-2"
                      >
                        الرحلات
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setWalletData({
                            amount: '',
                            description: 'شحن رصيد السائق'
                          });
                          setShowWalletModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        شحن المحفظة
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setPasswordData({
                            password: '',
                            confirmPassword: ''
                          });
                          setShowPasswordModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-800 ml-2"
                      >
                        تغيير كلمة المرور
                      </button>
                      <button
                        onClick={() => {
                          // إذا كان السائق من جدول المستخدمين فقط، قم بإنشاء سجل سائق جديد
                          if (driver._isFromUserTable) {
                            toast.info('هذا السائق موجود في جدول المستخدمين فقط. سيتم إنشاء سجل سائق كامل له.');
                            
                            // إنشاء سجل سائق جديد
                            supabase
                              .from('drivers')
                              .insert([{
                                user_id: driver.user_id,
                                name: driver.name,
                                phone: driver.phone,
                                email: driver.email,
                                status: 'offline',
                                password: 'password123' // كلمة مرور افتراضية
                              }])
                              .then(({ data, error }) => {
                                if (error) {
                                  console.error('Error creating driver record:', error);
                                  toast.error('فشل في إنشاء سجل السائق');
                                } else {
                                  toast.success('تم إنشاء سجل السائق بنجاح');
                                  fetchDrivers(); // إعادة تحميل البيانات
                                }
                              });
                            
                            return;
                          }
                          
                          setEditingDriver(driver);
                          setFormData({
                            name: driver.name,
                            phone: driver.phone,
                            email: driver.email,
                            status: driver.status,
                            vehicle_type: driver.vehicle_type,
                            vehicle_plate: driver.vehicle_number || '',
                            service_area_id: driver.service_area_id || ''
                          });
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => {
                          // إذا كان السائق من جدول المستخدمين فقط، اعرض رسالة مختلفة
                          if (driver._isFromUserTable) {
                            toast.info('لا يمكن حذف هذا السائق لأنه موجود في جدول المستخدمين فقط. قم بإنشاء سجل سائق له أولاً.');
                            return;
                          }
                          
                          handleDelete(driver.id);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30"></div>

            <div className="relative bg-white rounded-lg p-8 max-w-3xl w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                {editingDriver ? 'تعديل سائق' : 'إضافة سائق جديد'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم السائق
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
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
                      className="w-full border rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الحالة
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="offline">غير متصل</option>
                      <option value="available">متاح</option>
                      <option value="busy">مشغول</option>
                    </select>
                  </div>

                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">منطقة الخدمة</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      منطقة الخدمة المخصصة للسائق
                    </label>
                    <select
                      value={formData.service_area_id}
                      onChange={(e) => setFormData({ ...formData, service_area_id: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="">-- بدون منطقة محددة (يستقبل كل الطلبات) --</option>
                      {serviceAreas.map(area => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      عند تحديد منطقة خدمة، سيستقبل السائق فقط الطلبات الخاصة بهذه المنطقة
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">معلومات المركبة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        نوع المركبة
                      </label>
                      <select
                        value={formData.vehicle_type}
                        onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="motorcycle">دراجة نارية</option>
                        <option value="car">سيارة</option>
                        <option value="bicycle">دراجة هوائية</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        رقم اللوحة
                      </label>
                      <input
                        type="text"
                        value={formData.vehicle_plate}
                        onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingDriver(null);
                    }}
                    className="px-4 py-2 text-gray-600  hover:text-gray-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {editingDriver ? 'تحديث' : 'إضافة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Driver Trips Modal */}
      {showTripsModal && selectedDriver && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowTripsModal(false)}></div>

            <div className="relative bg-white w-full max-w-4xl mx-4 rounded-lg shadow-xl">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">رحلات السائق: {selectedDriver.name}</h2>
                  <button
                    onClick={() => setShowTripsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <DriverTrips driverId={selectedDriver.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && selectedDriver && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowPasswordModal(false)}></div>

            <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                تغيير كلمة المرور للسائق: {selectedDriver.name}
              </h2>
              
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    كلمة المرور الجديدة <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                    minLength="6"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    كلمة المرور يجب أن تكون 6 أحرف على الأقل
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تأكيد كلمة المرور <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setSelectedDriver(null);
                      setPasswordData({
                        password: '',
                        confirmPassword: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={changingPassword || !passwordData.password || !passwordData.confirmPassword}
                  >
                    {changingPassword ? 'جاري تحديث كلمة المرور...' : 'تحديث كلمة المرور'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Charge Wallet Modal */}
      {showWalletModal && selectedDriver && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowWalletModal(false)}></div>

            <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                شحن محفظة السائق: {selectedDriver.name}
              </h2>
              
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المبلغ (₪) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={walletData.amount}
                    onChange={(e) => setWalletData({ ...walletData, amount: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
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
                    className="w-full border rounded-md px-3 py-2"
                    rows="2"
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWalletModal(false);
                      setSelectedDriver(null);
                      setWalletData({
                        amount: '',
                        description: 'شحن رصيد السائق'
                      });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleChargeWallet}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    disabled={chargingWallet || !walletData.amount || parseFloat(walletData.amount) <= 0}
                  >
                    {chargingWallet ? 'جاري شحن المحفظة...' : 'شحن المحفظة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}