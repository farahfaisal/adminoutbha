import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  getUserPaymentNotifications, 
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats
} from '../../lib/paymentNotificationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';
import { Bell, Check, Archive, Filter, Search } from 'lucide-react';

export default function PaymentNotificationsList() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(true);
      fetchStats();
    }
  }, [user?.id, filter]);

  const fetchNotifications = async (reset = false) => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const currentPage = reset ? 0 : page;
      const statusFilter = filter === 'unread' ? 'unread' : 
                          filter === 'read' ? 'read' : null;
      
      const data = await getUserPaymentNotifications(user.id, {
        limit: 20,
        offset: currentPage * 20,
        status: statusFilter
      });
      
      if (reset) {
        setNotifications(data);
        setPage(0);
      } else {
        setNotifications(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === 20);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('فشل في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.id) return;
    
    try {
      const data = await getNotificationStats(user.id);
      setStats(data);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, status: 'read', read_at: new Date().toISOString() }
            : notification
        )
      );
      
      fetchStats();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('فشل في تحديث حالة الإشعار');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const updatedCount = await markAllNotificationsAsRead(user.id);
      
      if (updatedCount > 0) {
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            status: 'read',
            read_at: new Date().toISOString()
          }))
        );
        
        fetchStats();
        toast.success(`تم تحديد ${updatedCount} إشعار كمقروء`);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('فشل في تحديث الإشعارات');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_received':
        return '💰';
      case 'payment_failed':
        return '❌';
      case 'wallet_charged':
        return '💳';
      case 'wallet_low_balance':
        return '⚠️';
      case 'commission_earned':
        return '💵';
      case 'withdrawal_approved':
        return '✅';
      case 'withdrawal_rejected':
        return '❌';
      case 'refund_processed':
        return '↩️';
      case 'subscription_expired':
        return '⏰';
      case 'payment_reminder':
        return '🔔';
      default:
        return '📄';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-r-4 border-red-500';
      case 'high':
        return 'border-r-4 border-orange-500';
      case 'normal':
        return 'border-r-4 border-blue-500';
      case 'low':
        return 'border-r-4 border-gray-500';
      default:
        return 'border-r-4 border-gray-500';
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'payment_received': return 'دفعة مستلمة';
      case 'payment_failed': return 'فشل في الدفع';
      case 'wallet_charged': return 'شحن المحفظة';
      case 'wallet_low_balance': return 'رصيد منخفض';
      case 'commission_earned': return 'عمولة مكتسبة';
      case 'withdrawal_approved': return 'موافقة على السحب';
      case 'withdrawal_rejected': return 'رفض السحب';
      case 'refund_processed': return 'استرداد معالج';
      case 'subscription_expired': return 'انتهاء الاشتراك';
      case 'payment_reminder': return 'تذكير بالدفع';
      default: return type;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return notification.title.toLowerCase().includes(searchLower) ||
             notification.message.toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إشعارات الدفع</h2>
        <div className="flex gap-2">
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            disabled={stats.unread === 0}
          >
            <Check className="w-4 h-4" />
            تحديد الكل كمقروء
          </button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
          <div className="text-sm text-gray-600">إجمالي الإشعارات</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-orange-600">{stats.unread || 0}</div>
          <div className="text-sm text-gray-600">غير مقروء</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">{stats.read || 0}</div>
          <div className="text-sm text-gray-600">مقروء</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-red-600">{stats.urgent || 0}</div>
          <div className="text-sm text-gray-600">عاجل</div>
        </div>
      </div>

      {/* أدوات التصفية والبحث */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث في الإشعارات..."
                className="w-full pr-10 border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'unread' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              غير مقروء
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'read' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              مقروء
            </button>
          </div>
        </div>
      </div>

      {/* قائمة الإشعارات */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading && notifications.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">لا توجد إشعارات</h3>
            <p>لم يتم العثور على إشعارات تطابق معايير البحث</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  notification.status === 'unread' ? 'bg-blue-50' : ''
                } ${getPriorityColor(notification.priority)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className={`text-lg font-medium ${
                          notification.status === 'unread' ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h3>
                        <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          {getTypeText(notification.notification_type)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          {formatDate(notification.created_at)}
                        </span>
                        {notification.status === 'unread' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 mr-auto"></div>
                        )}
                      </div>
                    </div>
                    
                    <p className={`text-sm mb-3 ${
                      notification.status === 'unread' ? 'text-gray-800' : 'text-gray-600'
                    }`}>
                      {notification.message}
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        {notification.amount && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                            {notification.currency === 'ILS' ? '₪' : notification.currency}
                            {parseFloat(notification.amount).toFixed(2)}
                          </span>
                        )}
                        
                        {notification.vendor_name && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {notification.vendor_name}
                          </span>
                        )}
                        
                        {notification.customer_name && (
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                            {notification.customer_name}
                          </span>
                        )}
                        
                        {notification.driver_name && (
                          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            {notification.driver_name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {notification.status === 'unread' && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" />
                            تحديد كمقروء
                          </button>
                        )}
                        
                        {notification.read_at && (
                          <span className="text-xs text-gray-500">
                            قُرئ في {formatDate(notification.read_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* تحميل المزيد */}
        {hasMore && filteredNotifications.length > 0 && (
          <div className="p-6 border-t border-gray-200 text-center">
            <button
              onClick={() => {
                setPage(prev => prev + 1);
                fetchNotifications();
              }}
              className="text-blue-600 hover:text-blue-800"
              disabled={loading}
            >
              {loading ? 'جاري التحميل...' : 'تحميل المزيد'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}