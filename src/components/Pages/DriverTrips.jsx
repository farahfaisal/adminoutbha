import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';

export default function DriverTrips({ driverId }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchTrips();
  }, [driverId, activeTab]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      // Define status filter based on active tab
      let statusFilter;
      switch (activeTab) {
        case 'active':
          statusFilter = ['assigned', 'in_progress'];
          break;
        case 'completed':
          statusFilter = ['completed'];
          break;
        case 'cancelled':
          statusFilter = ['cancelled'];
          break;
        default:
          statusFilter = ['assigned', 'in_progress', 'completed', 'cancelled'];
      }

      // Start building the query
      let query = supabase
        .from('driver_trips')
        .select(`
          *,
          order:order_id(id, order_number, status, created_at)
        `)
        .in('status', statusFilter)
        .order('assigned_at', { ascending: false });

      // Only apply driver_id filter if it's provided
      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      // Execute the query
      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching driver trips:', error);
      setError('فشل في تحميل رحلات السائق');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (tripId, newStatus) => {
    try {
      const { data, error } = await supabase.rpc(
        'update_trip_status',
        {
          p_trip_id: tripId,
          p_status: newStatus,
          p_note: newStatus === 'completed' ? 'تم اكتمال التوصيل بواسطة السائق' : `تم تحديث حالة الرحلة إلى ${getStatusText(newStatus)}`
        }
      );

      if (error) throw error;
      
      toast.success(`تم تحديث حالة الرحلة إلى ${getStatusText(newStatus)}`);
      fetchTrips();
    } catch (error) {
      console.error('Error updating trip status:', error);
      toast.error('فشل في تحديث حالة الرحلة');
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'معينة';
      case 'in_progress': return 'قيد التنفيذ';
      case 'completed': return 'مكتملة';
      case 'cancelled': return 'ملغية';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button
          onClick={fetchTrips}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'active'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          الرحلات النشطة
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'completed'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          الرحلات المكتملة
        </button>
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'cancelled'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          الرحلات الملغية
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'all'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          جميع الرحلات
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <p className="text-gray-500">لا توجد رحلات {activeTab === 'active' ? 'نشطة' : activeTab === 'completed' ? 'مكتملة' : activeTab === 'cancelled' ? 'ملغية' : ''} {driverId ? 'لهذا السائق' : ''}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الطلب</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العميل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عنوان الاستلام</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عنوان التوصيل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ التعيين</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trips.map(trip => (
                <tr key={trip.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {trip.order?.order_number || trip.order?.id?.substring(0, 8) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium">{trip.customer_name || '-'}</div>
                      <div className="text-sm text-gray-500">{trip.customer_phone || '-'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs truncate">{trip.pickup_address || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs truncate">{trip.delivery_address || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ₪{parseFloat(trip.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(trip.status)}`}>
                      {getStatusText(trip.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(trip.assigned_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {trip.status === 'assigned' && (
                      <button
                        onClick={() => handleUpdateStatus(trip.id, 'in_progress')}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        بدء الرحلة
                      </button>
                    )}
                    {trip.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(trip.id, 'completed')}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 ml-2"
                      >
                        إكمال الرحلة
                      </button>
                    )}
                    {(trip.status === 'assigned' || trip.status === 'in_progress') && (
                      <button
                        onClick={() => handleUpdateStatus(trip.id, 'cancelled')}
                        className="text-red-600 hover:text-red-800"
                      >
                        إلغاء
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}