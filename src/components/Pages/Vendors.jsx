import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getVendors } from '../../lib/vendorsApi';
import { getRatingsByType } from '../../lib/ratingsApi';
import { supabase } from '../../lib/supabase';
import { RatingStars } from '../Rating';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [vendorRatings, setVendorRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    fetchVendors();
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

  const fetchVendors = async () => {
    try {
      setLoading(true);
      // Fetch real data from Supabase
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('فشل في تحميل البائعين');
      
      // Fallback to mock data if API fails
      setVendors([
        {
          id: 1,
          store_name: 'متجر كوفي',
          phone: '0599123456',
          address: 'غزة - الرمال',
          description: 'متجر متخصص في القهوة والمشروبات الساخنة',
          rating: 4.8,
          rating_count: 156,
          status: 'active',
          logo_url: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?q=80&w=100&auto=format&fit=crop',
          banner_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=400&auto=format&fit=crop',
          delivery_type: 'distance',
          delivery_radius: 5,
          price_per_km: 2
        },
        {
          id: 2,
          store_name: 'متجر الشاي',
          phone: '0599234567',
          address: 'غزة - النصر',
          description: 'متجر متخصص في الشاي والأعشاب',
          rating: 4.5,
          rating_count: 98,
          status: 'active',
          logo_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=100&auto=format&fit=crop',
          banner_url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?q=80&w=400&auto=format&fit=crop',
          delivery_type: 'fixed',
          delivery_radius: null,
          price_per_km: null
        },
        {
          id: 3,
          store_name: 'متجر العصائر',
          phone: '0599345678',
          address: 'غزة - التفاح',
          description: 'متجر متخصص في العصائر الطازجة',
          rating: 4.7,
          rating_count: 120,
          status: 'active',
          logo_url: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?q=80&w=100&auto=format&fit=crop',
          banner_url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?q=80&w=400&auto=format&fit=crop',
          delivery_type: 'distance',
          delivery_radius: 3,
          price_per_km: 3
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      // تحديث حالة البائع
      const { error } = await supabase.rpc('update_vendor_status', {
        p_vendor_id: vendorId,
        p_status: newStatus
      });
      
      if (error) throw error;
      
      // تحديث قائمة البائعين في واجهة المستخدم
      setVendors(vendors.map(v => 
        v.id === vendorId ? { ...v, status: newStatus } : v
      ));
      
      toast.success(`تم تغيير حالة البائع إلى ${getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast.error('فشل في تحديث حالة البائع');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'مفتوح';
      case 'inactive': return 'مغلق';
      case 'busy': return 'مشغول';
      case 'pending': return 'معلق';
      case 'suspended': return 'موقوف';
      default: return status;
    }
  };

  const getDeliveryTypeText = (type) => {
    switch (type) {
      case 'distance': return 'حسب المسافة';
      case 'fixed': return 'سعر ثابت';
      case 'zones': return 'مناطق';
      default: return type;
    }
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {vendors.map(vendor => {
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
          </div>
        </div>
        );
      })}
    </div>
  );

  const renderTableView = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتجر</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التقييم</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنوان</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التوصيل</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وقت التوصيل</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors.map(vendor => {
              const isInactive = vendor.status === 'inactive';
              const isBusy = vendor.status === 'busy';
              const isSuspended = vendor.status === 'suspended';
              const rowClass = isInactive || isSuspended ? 'bg-gray-100 opacity-75' : '';

              return (
              <tr key={vendor.id} className={rowClass}>
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
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">
                      {vendor.estimated_delivery_time || 30} دقيقة
                    </span>
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
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getStatusStats = () => {
    return {
      active: vendors.filter(v => v.status === 'active').length,
      inactive: vendors.filter(v => v.status === 'inactive').length,
      busy: vendors.filter(v => v.status === 'busy').length,
      suspended: vendors.filter(v => v.status === 'suspended').length,
      pending: vendors.filter(v => v.status === 'pending').length,
    };
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (!window.confirm(`هل تريد تغيير حالة جميع المتاجر إلى "${getStatusText(newStatus)}"؟`)) {
      return;
    }

    const statusChangePromises = vendors.map(vendor =>
      handleStatusChange(vendor.id, newStatus)
    );

    try {
      await Promise.all(statusChangePromises);
      toast.success(`تم تغيير حالة جميع المتاجر إلى ${getStatusText(newStatus)}`);
    } catch (error) {
      toast.error('فشل في تغيير حالة بعض المتاجر');
    }
  };

  const stats = getStatusStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">البائعين</h2>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* إحصائيات سريعة وأزرار التحكم السريع */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* إحصائيات الحالة */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-3">إحصائيات المتاجر</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-green-700">مفتوح</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
              <div className="text-xs text-red-700">مغلق</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.busy}</div>
              <div className="text-xs text-yellow-700">مشغول</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.suspended}</div>
              <div className="text-xs text-gray-700">موقوف</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <div className="text-xs text-blue-700">معلق</div>
            </div>
          </div>
        </div>

        {/* أزرار التحكم السريع */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-3">تحكم سريع - تطبيق على الكل</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleBulkStatusChange('active')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              فتح الكل
            </button>
            <button
              onClick={() => handleBulkStatusChange('inactive')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              إغلاق الكل
            </button>
            <button
              onClick={() => handleBulkStatusChange('busy')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              مشغول
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? renderGridView() : renderTableView()}
    </div>
  );
}