import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import VendorFormWizard from '../Vendors/VendorFormWizard';
import { saveVendorType } from '../../lib/vendorType';
import { getRatingsByType } from '../../lib/ratingsApi';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { RatingStars } from '../Rating';
import { chargeVendorWallet } from '../../lib/walletApi';
import { v4 as uuidv4 } from 'uuid';


// أعمدة جدول vendors في قاعدة البيانات
const VENDOR_COLUMNS = [
  'store_name', 'phone', 'address', 'description', 'rating', 'rating_count', 'commission_rate',
  'delivery_type', 'delivery_radius', 'price_per_km', 'latitude', 'longitude', 'status',
  'logo_url', 'banner_url', 'featured_until', 'featured_order', 'auto_charge', 'wallet_enabled',
  'service_areas', 'membership', 'min_delivery_fee', 'delivery_fee_per_km', 'featured', 'type',
  'delivery_zones', 'email', 'estimated_delivery_time', 'working_hours', 'holidays',
  'auto_status_change', 'timezone', 'main_service_area_id', 'global_discount_enabled',
  'global_discount_percentage'
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [vendorRatings, setVendorRatings] = useState({});
  const [deletingVendor, setDeletingVendor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [editingInline, setEditingInline] = useState(null);
  const [inlineData, setInlineData] = useState({});
  const navigate = useNavigate();

  // Wallet charge states
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [walletData, setWalletData] = useState({
    amount: '',
    description: 'شحن رصيد البائع'
  });
  const [chargingWallet, setChargingWallet] = useState(false);

  // Define initial filters for vendors
  const initialFilters = {
    search: {
      type: 'text',
      label: 'بحث',
      value: '',
      placeholder: 'ابحث عن اسم المتجر، العنوان، الهاتف...'
    },
    status: {
      type: 'select',
      label: 'الحالة',
      value: '',
      options: [
        { value: '', label: 'الكل' },
        { value: 'active', label: 'مفتوح' },
        { value: 'inactive', label: 'مغلق' },
        { value: 'busy', label: 'مشغول' },
        { value: 'pending', label: 'معلق' },
        { value: 'suspended', label: 'موقوف' }
      ]
    },
    delivery_type: {
      type: 'select',
      label: 'نوع التوصيل',
      value: '',
      options: [
        { value: '', label: 'الكل' },
        { value: 'distance', label: 'حسب المسافة' },
        { value: 'fixed', label: 'سعر ثابت' },
        { value: 'zones', label: 'حسب المناطق' }
      ]
    }
  };

  // Initialize the useFilters hook
  const { filters, handleFilterChange, filterData } = useFilters(initialFilters);

  useEffect(() => {
    fetchData();
    fetchVendorRatings();
  }, []);

  const fetchVendorRatings = async () => {
    try {
      const ratings = await getRatingsByType('vendor');
      
      // Group ratings by vendor ID
      const ratingsByVendor = {};
      ratings.forEach(rating => {
        if (!ratingsByVendor[rating.to_id]) {
          ratingsByVendor[rating.to_id] = [];
        }
        ratingsByVendor[rating.to_id].push(rating);
      });
      
      setVendorRatings(ratingsByVendor);
    } catch (error) {
      console.error('Error fetching vendor ratings:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*');

      if (error) throw error;

      setVendors(data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorWithRelations = async (vendor) => {
    try {
      // تحميل التصنيفات
      const { data: vendorCategories, error: categoriesError } = await supabase
        .from('vendor_categories')
        .select('category_id')
        .eq('vendor_id', vendor.id);

      if (categoriesError) {
        console.error('Error loading vendor categories:', categoriesError);
      }

      // تحميل مناطق الخدمة
      const { data: serviceAreas, error: serviceAreasError } = await supabase
        .from('vendor_service_areas')
        .select('*')
        .eq('vendor_id', vendor.id);

      if (serviceAreasError) {
        console.error('Error loading vendor service areas:', serviceAreasError);
      }

      // التأكد من تنسيق البيانات بشكل صحيح
      return {
        ...vendor,
        categories: vendorCategories ? vendorCategories.map(vc => vc.category_id) : [],
        vendor_service_areas: serviceAreas || [],
        // التأكد من وجود هذه الحقول حتى لو كانت null
        delivery_zones: vendor.delivery_zones || [],
        working_hours: vendor.working_hours || {
          saturday: { enabled: true, open: '08:00', close: '22:00' },
          sunday: { enabled: true, open: '08:00', close: '22:00' },
          monday: { enabled: true, open: '08:00', close: '22:00' },
          tuesday: { enabled: true, open: '08:00', close: '22:00' },
          wednesday: { enabled: true, open: '08:00', close: '22:00' },
          thursday: { enabled: true, open: '08:00', close: '22:00' },
          friday: { enabled: false, open: null, close: null }
        },
        holidays: vendor.holidays || [],
        membership: vendor.membership || {
          type: 'basic',
          expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          commission_rate: 10
        },
        logo_url: vendor.logo_url || '',
        banner_url: vendor.banner_url || '',
        estimated_delivery_time: vendor.estimated_delivery_time || 30
      };
    } catch (error) {
      console.error('Error loading vendor relations:', error);
      return vendor;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البائع؟ سيتم حذف جميع المنتجات والطلبات المرتبطة به.')) return;
    
    try {
      setDeletingVendor(id);
      setLoading(true);
      
      // Step 1: Get all products for this vendor
      const { data: vendorProducts, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('vendor_id', id);
      
      if (productsError) throw productsError;
      
      const productIds = vendorProducts.map(p => p.id);
      
      // Step 2: Delete order items that reference these products
      if (productIds.length > 0) {
        const { error: orderItemsError } = await supabase
          .from('order_items')
          .delete()
          .in('product_id', productIds);
        
        if (orderItemsError) throw orderItemsError;
      }
      
      // Step 3: Delete all products for this vendor
      const { error: deleteProductsError } = await supabase
        .from('products')
        .delete()
        .eq('vendor_id', id);
      
      if (deleteProductsError) throw deleteProductsError;
      
      // Step 4: Delete vendor-related data
      // Delete vendor categories
      const { error: vendorCategoriesError } = await supabase
        .from('vendor_categories')
        .delete()
        .eq('vendor_id', id);
      
      if (vendorCategoriesError) throw vendorCategoriesError;
      
      // Delete vendor custom categories
      const { error: customCategoriesError } = await supabase
        .from('vendor_custom_categories')
        .delete()
        .eq('vendor_id', id);
      
      if (customCategoriesError) throw customCategoriesError;
      
      // Delete vendor to category relationships
      const { error: vendorToCategoryError } = await supabase
        .from('vendor_to_category')
        .delete()
        .eq('vendor_id', id);
      
      if (vendorToCategoryError) throw vendorToCategoryError;
      
      // Delete vendor drivers
      const { error: vendorDriversError } = await supabase
        .from('vendor_drivers')
        .delete()
        .eq('vendor_id', id);
      
      if (vendorDriversError) throw vendorDriversError;
      
      // Delete vendor wallets
      const { error: vendorWalletsError } = await supabase
        .from('vendor_wallets')
        .delete()
        .eq('vendor_id', id);
      
      if (vendorWalletsError) throw vendorWalletsError;
      
      // Delete advertisements
      const { error: advertisementsError } = await supabase
        .from('advertisements')
        .delete()
        .eq('vendor_id', id);
      
      if (advertisementsError) throw advertisementsError;
      
      // Delete slider advertisements
      const { error: sliderAdsError } = await supabase
        .from('slider_advertisements')
        .delete()
        .eq('vendor_id', id);
      
      if (sliderAdsError) throw sliderAdsError;
      
      // Delete vendor app sessions
      const { error: appSessionsError } = await supabase
        .from('vendor_app_sessions')
        .delete()
        .eq('vendor_id', id);
      
      if (appSessionsError) throw appSessionsError;
      
      // Delete driver waiting list entries
      const { error: waitingListError } = await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('vendor_id', id);
      
      if (waitingListError) throw waitingListError;
      
      // Step 5: Finally delete the vendor
      const { error: vendorError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);
      
      if (vendorError) throw vendorError;
      
      // Update local state
      setVendors(vendors.filter(v => v.id !== id));
      
      toast.success('تم حذف البائع وجميع البيانات المرتبطة به بنجاح');
      
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error(`فشل في حذف البائع: ${error.message}`);
    } finally {
      setLoading(false);
      setDeletingVendor(null);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setVendors(vendors.map(v => 
        v.id === id ? { ...v, status } : v
      ));

      toast.success('تم تحديث حالة البائع بنجاح');
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast.error('فشل في تحديث حالة البائع');
    }
  };

  // Function to handle charging vendor wallet
  const handleChargeWallet = async () => {
    if (!selectedVendor) {
      toast.error('الرجاء اختيار بائع');
      return;
    }

    if (!walletData.amount || parseFloat(walletData.amount) <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    try {
      setChargingWallet(true);
      console.log("Charging vendor wallet:", selectedVendor.id, parseFloat(walletData.amount));

      // Call the chargeVendorWallet function from walletApi
      const result = await chargeVendorWallet(
        selectedVendor.id,
        parseFloat(walletData.amount),
        walletData.description || 'شحن رصيد البائع'
      );

      console.log("Charge result:", result);

      if (!result || !result.success) {
        throw new Error(result?.message || 'فشل في شحن محفظة البائع');
      }

      toast.success(`تم شحن محفظة البائع ${selectedVendor.store_name} بمبلغ ${walletData.amount} شيكل بنجاح`);

      // Reset form and close modal
      setWalletData({
        amount: '',
        description: 'شحن رصيد البائع'
      });
      setShowWalletModal(false);
      setSelectedVendor(null);

      // Refresh vendors list
      fetchData();

    } catch (error) {
      console.error('Error charging wallet:', error);
      toast.error(error.message || 'فشل في شحن محفظة البائع');
    } finally {
      setChargingWallet(false);
    }
  };

  // Helper function to hash password (simple implementation)
  const hashPassword = async (password) => {
    // For production, use a proper hashing library like bcrypt
    // This is a simple implementation for demonstration
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Helper function to generate username from store name
  const generateUsername = (storeName) => {
    const baseUsername = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseUsername}_${randomSuffix}`;
  };

  // Function to create a new user
  const addCustomUser = async (userData) => {
    try {
      const hashedPassword = userData.password ? await hashPassword(userData.password) : null;
      
      const { data, error } = await supabase
        .from('custom_users')
        .insert([{
          id: uuidv4(),
          username: userData.username,
          password_hash: hashedPassword,
          password: userData.password, // Store plain password if needed
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          role: 'vendor',
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  // Fallback user creation function
  const fallbackUserCreation = async (userData) => {
    try {
      const { data, error } = await supabase
        .from('custom_users')
        .insert([{
          id: uuidv4(),
          username: userData.username,
          name: userData.name,
          email: userData.email || null,
          phone: userData.phone || null,
          role: 'vendor',
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error in fallback user creation:', error);
      throw error;
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      // التحقق من البيانات المطلوبة فقط في حالة الإضافة
      if (!editingVendor && (!formData.store_name || !formData.phone)) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        setLoading(false);
        return;
      }

      // Remove fields that don't exist in the vendors table
      const { categories, password, vendor_service_areas, ...rawFormData } = formData;
      // نرسل فقط الأعمدة الموجودة فعلاً في جدول vendors، وإلا يرفض Supabase الحفظ كاملاً
      const cleanedFormData = Object.fromEntries(
        Object.entries(rawFormData).filter(([key]) => VENDOR_COLUMNS.includes(key))
      );

      // تحويل service_areas إلى zones لأن قاعدة البيانات لا تدعم service_areas
      if (cleanedFormData.delivery_type === 'service_areas') {
        cleanedFormData.delivery_type = 'zones';
      }

      // استخدام الدالة المناسبة لإدخال/تحديث البيانات
      if (editingVendor) {
        // تحديث بيانات البائع
        const { data, error } = await supabase
          .from('vendors')
          .update(cleanedFormData)
          .eq('id', editingVendor.id)
          .select();

        if (error) throw error;

        // نوع المتجر (مطاعم / ماركت) — تطبيق الزبون يعرض المتاجر حسب هذا الحقل
        if (categories && categories.length > 0) {
          const newType = await saveVendorType(editingVendor.id, categories);
          if (newType && data && data[0]) data[0].type = newType;
        }

        // تحديث التصنيفات
        if (categories !== undefined) {
          // حذف التصنيفات القديمة
          await supabase
            .from('vendor_categories')
            .delete()
            .eq('vendor_id', editingVendor.id);

          // إضافة التصنيفات الجديدة
          if (categories.length > 0) {
            const categoriesData = categories.map(categoryId => ({
              vendor_id: editingVendor.id,
              category_id: categoryId
            }));

            const { error: categoriesError } = await supabase
              .from('vendor_categories')
              .insert(categoriesData);

            if (categoriesError) {
              console.error('Error updating categories:', categoriesError);
            }
          }
        }

        // تحديث مناطق الخدمة إذا كانت موجودة
        if (vendor_service_areas) {
          // حذف مناطق الخدمة القديمة
          await supabase
            .from('vendor_service_areas')
            .delete()
            .eq('vendor_id', editingVendor.id);

          // إضافة مناطق الخدمة الجديدة
          if (vendor_service_areas.length > 0) {
            const serviceAreasData = vendor_service_areas.map(area => ({
              vendor_id: editingVendor.id,
              service_area_id: area.service_area_id,
              custom_delivery_price: area.custom_delivery_price
            }));

            const { error: serviceAreasError } = await supabase
              .from('vendor_service_areas')
              .insert(serviceAreasData);

            if (serviceAreasError) {
              console.error('Error updating service areas:', serviceAreasError);
            }
          }
        }

        setVendors(vendors.map(v => v.id === data[0].id ? data[0] : v));
        toast.success('تم تحديث البائع بنجاح');
      } else {
        // إضافة بائع جديد - need to create user first
        let userId;
        
        try {
          // Generate username from store name
          const username = generateUsername(formData.store_name);
          
          // Create user data
          const userData = {
            username,
            name: formData.store_name,
            email: formData.email || null,
            phone: formData.phone,
            password: formData.password || 'defaultpassword123'
          };

          // Try to create user with password
          let newUser;
          try {
            newUser = await addCustomUser(userData);
          } catch (userError) {
            console.warn('Failed to create user with password, trying fallback:', userError);
            // Fallback: create user without password
            newUser = await fallbackUserCreation(userData);
          }

          userId = newUser.id;
        } catch (userCreationError) {
          console.error('Failed to create user:', userCreationError);
          toast.error('فشل في إنشاء حساب المستخدم للبائع');
          setLoading(false);
          return;
        }

        // Add user_id to vendor data
        const vendorDataWithUser = {
          ...cleanedFormData,
          user_id: userId,
          email: formData.email // Make sure to include email in the vendor data
        };

        // إضافة بائع جديد
        const { data, error } = await supabase
          .from('vendors')
          .insert([vendorDataWithUser])
          .select();

        if (error) throw error;

        const newVendorId = data[0].id;

        // حفظ التصنيفات
        // نوع المتجر (مطاعم / ماركت) — تطبيق الزبون يعرض المتاجر حسب هذا الحقل
        if (categories && categories.length > 0) {
          await saveVendorType(newVendorId, categories);
        }

        if (categories && categories.length > 0) {
          const categoriesData = categories.map(categoryId => ({
            vendor_id: newVendorId,
            category_id: categoryId
          }));

          const { error: categoriesError } = await supabase
            .from('vendor_categories')
            .insert(categoriesData);

          if (categoriesError) {
            console.error('Error linking categories:', categoriesError);
          }
        }

        // حفظ مناطق الخدمة إذا كانت موجودة
        if (vendor_service_areas && vendor_service_areas.length > 0) {
          const serviceAreasData = vendor_service_areas.map(area => ({
            vendor_id: newVendorId,
            service_area_id: area.service_area_id,
            custom_delivery_price: area.custom_delivery_price
          }));

          const { error: serviceAreasError } = await supabase
            .from('vendor_service_areas')
            .insert(serviceAreasData);

          if (serviceAreasError) {
            console.error('Error linking service areas:', serviceAreasError);
          }
        }

        setVendors([...vendors, data[0]]);
        toast.success('تم إضافة البائع بنجاح');
      }

      // إغلاق النموذج
      setShowModal(false);
      setEditingVendor(null);
    } catch (error) {
      console.error('Error saving vendor:', error);
      toast.error('فشل في حفظ البائع');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      busy: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-blue-100 text-blue-800',
      suspended: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDeliveryTypeText = (type) => {
    const types = {
      distance: 'حسب المسافة',
      fixed: 'سعر ثابت',
      zones: 'حسب المناطق'
    };
    return types[type] || type;
  };

  const filteredVendors = filterData(vendors);

  if (loading && vendors.length === 0) {
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">البائعين</h2>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded ${
                viewMode === 'grid' 
                  ? 'bg-white shadow' 
                  : 'hover:bg-gray-200'
              }`}
            >
              عرض شبكي
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded ${
                viewMode === 'table' 
                  ? 'bg-white shadow' 
                  : 'hover:bg-gray-200'
              }`}
            >
              عرض جدول
            </button>
          </div>
          <button
            onClick={() => {
              setEditingVendor(null);
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة بائع جديد
          </button>
        </div>
      </div>

      <SearchFilter 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredVendors.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">لا توجد بائعين متطابقين مع معايير البحث</p>
            </div>
          ) : (
            filteredVendors.map(vendor => {
              const isInactive = vendor.status === 'inactive';
              const isBusy = vendor.status === 'busy';
              const isSuspended = vendor.status === 'suspended';
              const showOverlay = isInactive || isBusy || isSuspended;

              return (
              <div key={vendor.id} className={`bg-white rounded-lg shadow-md overflow-hidden relative ${showOverlay ? 'opacity-75' : ''}`}>
                {isInactive && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg transform rotate-[-15deg]">
                      <span className="text-2xl font-bold">مُغلق</span>
                    </div>
                  </div>
                )}
                {isBusy && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-orange-600 text-white px-6 py-3 rounded-lg shadow-lg transform rotate-[-15deg]">
                      <span className="text-2xl font-bold">مشغول</span>
                    </div>
                  </div>
                )}
                {isSuspended && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg transform rotate-[-15deg]">
                      <span className="text-2xl font-bold">موقوف</span>
                    </div>
                  </div>
                )}
                {vendor.banner_url && (
                  <img
                    src={vendor.banner_url}
                    alt={`${vendor.store_name} banner`}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                    }}
                  />
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      {vendor.logo_url && (
                        <img 
                          src={vendor.logo_url} 
                          alt={vendor.store_name}
                          className="w-10 h-10 rounded-full object-cover ml-3"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/40?text=Logo';
                          }}
                        />
                      )}
                      <h3 className="text-lg font-semibold">{vendor.store_name}</h3>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="relative inline-block mb-2">
                      <select
                        value={vendor.status}
                        onChange={(e) => handleStatusChange(vendor.id, e.target.value)}
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(vendor.status)} appearance-none pr-8 cursor-pointer`}
                      >
                        <option value="active">مفتوح</option>
                        <option value="inactive">مغلق</option>
                        <option value="busy">مشغول</option>
                        <option value="pending">معلق</option>
                        <option value="suspended">موقوف</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      </div>
                      {vendorRatings[vendor.id] && (
                        <div className="flex items-center">
                          <RatingStars rating={vendor.rating} size="sm" />
                          <span className="text-xs text-gray-500 mr-1">({vendorRatings[vendor.id].length} تقييم)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">{vendor.description}</p>
                  <div className="mt-4 space-y-1 text-sm">
                    <p className="text-gray-500">{vendor.address}</p>
                    <p className="text-gray-500">{vendor.phone}</p>
                    {vendor.email && <p className="text-gray-500">{vendor.email}</p>}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {getDeliveryTypeText(vendor.delivery_type)}
                      </div>
                      {vendor.delivery_type === 'distance' && (
                        <div className="text-sm text-gray-500">
                          {vendor.delivery_radius} كم - ₪{vendor.price_per_km}/كم
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setSelectedVendor(vendor);
                        setWalletData({
                          amount: '',
                          description: 'شحن رصيد البائع'
                        });
                        setShowWalletModal(true);
                      }}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 ml-2"
                    >
                      شحن المحفظة
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.rpc('toggle_vendor_featured', {
                            p_vendor_id: vendor.id,
                            p_featured: !vendor.featured,
                            p_featured_until: vendor.featured ? null : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
                            p_featured_order: vendor.featured ? null : 1
                          });
                          
                          if (error) throw error;
                          
                          setVendors(vendors.map(v => 
                            v.id === vendor.id ? { ...v, featured: !vendor.featured } : v
                          ));
                          
                          toast.success(vendor.featured ? 'تم إلغاء تمييز البائع' : 'تم تعيين البائع كمميز');
                        } catch (error) {
                          console.error('Error toggling featured status:', error);
                          toast.error('فشل في تغيير حالة التمييز');
                        }
                      }}
                      className={`${
                        vendor.featured 
                          ? 'text-gray-600 hover:text-gray-800' 
                          : 'text-yellow-600 hover:text-yellow-800'
                      } ml-2`}
                    >
                      {vendor.featured ? 'إلغاء التمييز' : 'تعيين كمميز'}
                    </button>
                    <button
                      onClick={async () => {
                        const vendorWithRelations = await loadVendorWithRelations(vendor);
                        setEditingVendor(vendorWithRelations);
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={deletingVendor === vendor.id}
                    >
                      {deletingVendor === vendor.id ? 'جاري الحذف...' : 'حذف'}
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التقييم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنوان</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التوصيل</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">مميز</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      لا توجد بائعين متطابقين مع معايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map(vendor => (
                    <tr key={vendor.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {vendor.logo_url && (
                            <img 
                              src={vendor.logo_url} 
                              alt={vendor.store_name}
                              className="w-10 h-10 rounded-full object-cover ml-3"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/40?text=Logo';
                              }}
                            />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{vendor.store_name}</div>
                            <div className="text-gray-500">{vendor.phone}</div>
                            {vendor.email && <div className="text-gray-500">{vendor.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center">
                          <RatingStars rating={vendor.rating} size="sm" />
                          <span className="text-xs text-gray-500 mt-1">
                            {vendorRatings[vendor.id] ? `(${vendorRatings[vendor.id].length} تقييم)` : `(${vendor.rating_count || 0} تقييم)`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {vendor.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getDeliveryTypeText(vendor.delivery_type)}
                          </div>
                          {vendor.delivery_type === 'distance' && (
                            <div className="text-sm text-gray-500">
                              {vendor.delivery_radius} كم - ₪{vendor.price_per_km}/كم
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative inline-block">
                          <select
                            value={vendor.status}
                            onChange={(e) => handleStatusChange(vendor.id, e.target.value)}
                            className={`px-2 py-1 text-xs rounded-full ${getStatusColor(vendor.status)} appearance-none pr-8 cursor-pointer`}
                          >
                            <option value="active">مفتوح</option>
                            <option value="inactive">مغلق</option>
                            <option value="busy">مشغول</option>
                            <option value="pending">معلق</option>
                            <option value="suspended">موقوف</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={vendor.featured || false}
                              onChange={async (e) => {
                                try {
                                  const { error } = await supabase
                                    .from('vendors')
                                    .update({ 
                                      featured: e.target.checked,
                                      featured_until: e.target.checked ? 
                                        new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() : 
                                        null,
                                      featured_order: e.target.checked ? 1 : null
                                    })
                                    .eq('id', vendor.id);
                                  
                                  if (error) throw error;
                                  
                                  setVendors(vendors.map(v => 
                                    v.id === vendor.id ? { 
                                      ...v, 
                                      featured: e.target.checked,
                                      featured_until: e.target.checked ? 
                                        new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() : 
                                        null,
                                      featured_order: e.target.checked ? 1 : null
                                    } : v
                                  ));
                                  
                                  toast.success(e.target.checked ? 'تم تعيين المتجر كمميز' : 'تم إلغاء تمييز المتجر');
                                } catch (error) {
                                  console.error('Error updating featured status:', error);
                                  toast.error('فشل في تحديث حالة التمييز');
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                            <span className="mr-3 text-sm font-medium text-gray-700">
                              {vendor.featured ? 'مميز' : 'غير مميز'}
                            </span>
                          </label>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setWalletData({
                              amount: '',
                              description: 'شحن رصيد البائع'
                            });
                            setShowWalletModal(true);
                          }}
                          className="text-green-600 hover:text-green-800 ml-2"
                        >
                          شحن المحفظة
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.rpc('toggle_vendor_featured', {
                                p_vendor_id: vendor.id,
                                p_featured: !vendor.featured,
                                p_featured_until: vendor.featured ? null : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
                                p_featured_order: vendor.featured ? null : 1
                              });
                              
                              if (error) throw error;
                              
                              setVendors(vendors.map(v => 
                                v.id === vendor.id ? { ...v, featured: !vendor.featured } : v
                              ));
                              
                              toast.success(vendor.featured ? 'تم إلغاء تمييز البائع' : 'تم تعيين البائع كمميز');
                            } catch (error) {
                              console.error('Error toggling featured status:', error);
                              toast.error('فشل في تغيير حالة التمييز');
                            }
                          }}
                          className={`${
                            vendor.featured 
                              ? 'text-gray-600 hover:text-gray-800' 
                              : 'text-yellow-600 hover:text-yellow-800'
                          } ml-4`}
                        >
                          {vendor.featured ? 'إلغاء التمييز' : 'تعيين كمميز'}
                        </button>
                        <button
                          onClick={async () => {
                            const vendorWithRelations = await loadVendorWithRelations(vendor);
                            setEditingVendor(vendorWithRelations);
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 ml-4"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={deletingVendor === vendor.id}
                        >
                          {deletingVendor === vendor.id ? 'جاري الحذف...' : 'حذف'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowModal(false)}></div>

            <div className="relative bg-white w-full min-h-screen">
              <div className="sticky top-0 bg-white border-b z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {editingVendor ? 'تعديل بائع' : 'إضافة بائع جديد'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingVendor(null);
                    }}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <VendorFormWizard
                  onSubmit={handleSubmit}
                  initialData={editingVendor}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Charge Modal */}
      {showWalletModal && selectedVendor && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowWalletModal(false)}></div>

            <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                شحن محفظة البائع: {selectedVendor.store_name}
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
                      setSelectedVendor(null);
                      setWalletData({
                        amount: '',
                        description: 'شحن رصيد البائع'
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