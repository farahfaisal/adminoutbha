import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Bell, X, Check, Archive, Settings, Filter } from 'lucide-react';
import { 
  getUserPaymentNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  archiveOldNotifications
} from '../../lib/paymentNotificationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';

export default function PaymentNotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, payment, wallet
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      fetchUnreadCount();
      
      // إعداد التحديث التلقائي كل 30 ثانية
      const interval = setInterval(() => {
        fetchUnreadCount();
        if (page === 0) {
          fetchNotifications(true);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    // إغلاق القائمة عند النقر خارجها
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async (refresh = false) => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const currentPage = refresh ? 0 : page;
      const statusFilter = filter === 'unread' ? 'unread' : null;
      
      const data = await getUserPaymentNotifications(user.id, {
        limit: 10,
        offset: currentPage * 10,
        status: statusFilter
      });
      
      if (refresh || currentPage === 0) {
        setNotifications(data);
      } else {
        setNotifications(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === 10);
      
      if (refresh) {
        setPage(0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('فشل في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    
    try {
      const count = await getUnreadNotificationsCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      
      // تحديث الحالة المحلية
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, status: 'read', read_at: new Date().toISOString() }
            : notification
        )
      );
      
      // تحديث العداد
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('فشل في تحديث حالة الإشعار');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const updatedCount = await markAllNotificationsAsRead(user.id);
      
      if (updatedCount > 0) {
        // تحديث الحالة المحلية
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            status: 'read',
            read_at: new Date().toISOString()
          }))
        );
        
        setUnreadCount(0);
        toast.success(`تم تحديد ${updatedCount} إشعار كمقروء`);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('فشل في تحديث الإشعارات');
    }
  };

  const handleArchiveOld = async () => {
    try {
      const archivedCount = await archiveOldNotifications(user.id, 30);
      
      if (archivedCount > 0) {
        toast.success(`تم أرشفة ${archivedCount} إشعار قديم`);
        fetchNotifications(true);
      } else {
        toast.info('لا توجد إشعارات قديمة للأرشفة');
      }
    } catch (error) {
      console.error('Error archiving old notifications:', error);
      toast.error('فشل في أرشفة الإشعارات القديمة');
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
        return 'border-r-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-r-4 border-orange-500 bg-orange-50';
      case 'normal':
        return 'border-r-4 border-blue-500 bg-blue-50';
      case 'low':
        return 'border-r-4 border-gray-500 bg-gray-50';
      default:
        return 'border-r-4 border-gray-500 bg-gray-50';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return notification.status === 'unread';
    if (filter === 'payment') return ['payment_received', 'payment_failed', 'commission_earned'].includes(notification.notification_type);
    if (filter === 'wallet') return ['wallet_charged', 'wallet_low_balance', 'withdrawal_approved', 'withdrawal_rejected'].includes(notification.notification_type);
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* زر الإشعارات */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* قائمة الإشعارات المنسدلة */}
      {showDropdown && (
        <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* رأس القائمة */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">إشعارات الدفع</h3>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* فلاتر */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === 'all' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === 'unread' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                غير مقروء ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('payment')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === 'payment' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                المدفوعات
              </button>
              <button
                onClick={() => setFilter('wallet')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === 'wallet' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                المحفظة
              </button>
            </div>
            
            {/* أزرار الإجراءات */}
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                disabled={unreadCount === 0}
              >
                <Check className="w-3 h-3" />
                تحديد الكل كمقروء
              </button>
              <button
                onClick={handleArchiveOld}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <Archive className="w-3 h-3" />
                أرشفة القديم
              </button>
            </div>
          </div>

          {/* قائمة الإشعارات */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      notification.status === 'unread' ? 'bg-blue-50' : ''
                    } ${getPriorityColor(notification.priority)}`}
                    onClick={() => {
                      if (notification.status === 'unread') {
                        handleMarkAsRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm font-medium ${
                            notification.status === 'unread' ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h4>
                          <span className="text-xs text-gray-500 whitespace-nowrap mr-2">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                        
                        <p className={`text-sm ${
                          notification.status === 'unread' ? 'text-gray-800' : 'text-gray-600'
                        }`}>
                          {notification.message}
                        </p>
                        
                        {notification.amount && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              {notification.currency === 'ILS' ? '₪' : notification.currency}
                              {parseFloat(notification.amount).toFixed(2)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex gap-2">
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
                          
                          {notification.status === 'unread' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* تحميل المزيد */}
          {hasMore && filteredNotifications.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setPage(prev => prev + 1);
                  fetchNotifications();
                }}
                className="w-full text-center text-blue-600 hover:text-blue-800 text-sm"
                disabled={loading}
              >
                {loading ? 'جاري التحميل...' : 'تحميل المزيد'}
              </button>
            </div>
          )}

          {/* رابط عرض الكل */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                setShowDropdown(false);
                // يمكن إضافة التنقل إلى صفحة الإشعارات الكاملة هنا
              }}
              className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              عرض جميع الإشعارات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}