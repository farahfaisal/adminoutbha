import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { 
  sendNotificationToUser, 
  sendNotificationToAll, 
  sendNotificationToTopic,
  getNotificationHistory,
  getNotificationStats,
  getUserActiveDevices,
  cancelScheduledNotification
} from '../../lib/firebaseNotificationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';
import { Bell, Send, Users, Smartphone, BarChart3, Settings } from 'lucide-react';

export default function FirebaseNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({
    total_sent: 0,
    total_delivered: 0,
    total_failed: 0,
    total_clicked: 0,
    delivery_rate: 0,
    click_rate: 0,
    active_devices: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('send');
  
  // إرسال إشعار جديد
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    target_type: 'all',
    target_value: '',
    image_url: '',
    click_action: '',
    priority: 'normal',
    data: {},
    scheduled_at: ''
  });
  const [sending, setSending] = useState(false);

  // إدارة الأجهزة
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDevices, setUserDevices] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // جلب سجل الإشعارات
      const notificationsData = await getNotificationHistory({ limit: 50 });
      setNotifications(notificationsData);
      
      // جلب إحصائيات الإشعارات
      const statsData = await getNotificationStats();
      setStats(statsData);
      
      // جلب الأجهزة المسجلة
      const { data: devicesData, error: devicesError } = await supabase
        .from('app_devices')
        .select(`
          *,
          user:user_id(name, email)
        `)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false });
      
      if (devicesError) throw devicesError;
      setDevices(devicesData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    try {
      setSending(true);
      
      // التحقق من البيانات المطلوبة
      if (!sendForm.title || !sendForm.body) {
        toast.error('الرجاء إدخال عنوان ونص الإشعار');
        return;
      }
      
      if (sendForm.target_type === 'user' && !sendForm.target_value) {
        toast.error('الرجاء اختيار المستخدم المستهدف');
        return;
      }
      
      if (sendForm.target_type === 'topic' && !sendForm.target_value) {
        toast.error('الرجاء إدخال اسم الموضوع');
        return;
      }
      
      // تحضير بيانات الإشعار
      const notificationData = {
        title: sendForm.title,
        body: sendForm.body,
        image_url: sendForm.image_url || null,
        click_action: sendForm.click_action || 'FLUTTER_NOTIFICATION_CLICK',
        priority: sendForm.priority,
        data: {
          ...sendForm.data,
          sent_from: 'admin_dashboard',
          sent_by: user?.name || 'مدير النظام'
        }
      };
      
      let notificationId;
      
      // إرسال الإشعار حسب النوع
      if (sendForm.target_type === 'all') {
        notificationId = await sendNotificationToAll(notificationData);
      } else if (sendForm.target_type === 'user') {
        notificationId = await sendNotificationToUser({
          ...notificationData,
          user_id: sendForm.target_value
        });
      } else if (sendForm.target_type === 'topic') {
        notificationId = await sendNotificationToTopic({
          ...notificationData,
          topic: sendForm.target_value
        });
      }
      
      toast.success('تم إرسال الإشعار بنجاح');
      
      // إعادة تعيين النموذج
      setSendForm({
        title: '',
        body: '',
        target_type: 'all',
        target_value: '',
        image_url: '',
        click_action: '',
        priority: 'normal',
        data: {},
        scheduled_at: ''
      });
      setShowSendModal(false);
      
      // تحديث البيانات
      fetchData();
      
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('فشل في إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const handleViewUserDevices = async (userId) => {
    try {
      setSelectedUser(userId);
      const devices = await getUserActiveDevices(userId);
      setUserDevices(devices);
      setShowDevicesModal(true);
    } catch (error) {
      console.error('Error fetching user devices:', error);
      toast.error('فشل في تحميل أجهزة المستخدم');
    }
  };

  const handleCancelNotification = async (notificationId) => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذا الإشعار؟')) return;
    
    try {
      await cancelScheduledNotification(notificationId);
      toast.success('تم إلغاء الإشعار بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error cancelling notification:', error);
      toast.error('فشل في إلغاء الإشعار');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'sent': return 'مرسل';
      case 'delivered': return 'تم التسليم';
      case 'failed': return 'فشل';
      case 'pending': return 'معلق';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeviceTypeIcon = (deviceType) => {
    switch (deviceType) {
      case 'android': return '🤖';
      case 'ios': return '📱';
      case 'web': return '🌐';
      default: return '📱';
    }
  };

  // عرض إرسال الإشعارات
  const renderSendTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">إرسال إشعار جديد</h3>
        <button
          onClick={() => setShowSendModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          إرسال إشعار
        </button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">{stats.total_sent}</div>
          <div className="text-sm text-gray-600">إجمالي المرسل</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">{stats.total_delivered}</div>
          <div className="text-sm text-gray-600">تم التسليم</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-purple-600">{stats.total_clicked}</div>
          <div className="text-sm text-gray-600">تم النقر</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-orange-600">{stats.active_devices}</div>
          <div className="text-sm text-gray-600">الأجهزة النشطة</div>
        </div>
      </div>

      {/* قوالب سريعة */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-semibold mb-4">قوالب سريعة</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setSendForm({
                ...sendForm,
                title: 'طلب جديد! 🛒',
                body: 'لديك طلب جديد في انتظار المعالجة',
                target_type: 'topic',
                target_value: 'vendors',
                priority: 'high',
                click_action: 'OPEN_ORDERS'
              });
              setShowSendModal(true);
            }}
            className="p-4 border border-blue-200 rounded-lg hover:bg-blue-50 text-left"
          >
            <div className="font-medium text-blue-800">إشعار طلب جديد</div>
            <div className="text-sm text-blue-600">للبائعين</div>
          </button>
          
          <button
            onClick={() => {
              setSendForm({
                ...sendForm,
                title: 'رحلة توصيل جديدة! 🚚',
                body: 'تم تعيين رحلة توصيل جديدة لك',
                target_type: 'topic',
                target_value: 'drivers',
                priority: 'high',
                click_action: 'OPEN_DELIVERIES'
              });
              setShowSendModal(true);
            }}
            className="p-4 border border-green-200 rounded-lg hover:bg-green-50 text-left"
          >
            <div className="font-medium text-green-800">إشعار رحلة توصيل</div>
            <div className="text-sm text-green-600">للسائقين</div>
          </button>
          
          <button
            onClick={() => {
              setSendForm({
                ...sendForm,
                title: 'عرض خاص! 🎉',
                body: 'لا تفوت العروض الحصرية المتاحة الآن',
                target_type: 'all',
                priority: 'normal',
                click_action: 'OPEN_OFFERS'
              });
              setShowSendModal(true);
            }}
            className="p-4 border border-purple-200 rounded-lg hover:bg-purple-50 text-left"
          >
            <div className="font-medium text-purple-800">إشعار ترويجي</div>
            <div className="text-sm text-purple-600">لجميع المستخدمين</div>
          </button>
        </div>
      </div>
    </div>
  );

  // عرض سجل الإشعارات
  const renderHistoryTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">سجل الإشعارات</h3>
        <button
          onClick={fetchData}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          تحديث
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">لا توجد إشعارات</h3>
          <p className="text-gray-500">لم يتم إرسال أي إشعارات بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنوان</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المحتوى</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الهدف</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الأولوية</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإحصائيات</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notifications.map(notification => (
                  <tr key={notification.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{notification.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {notification.body}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">
                          {notification.target_type === 'all' ? 'جميع المستخدمين' :
                           notification.target_type === 'user' ? 'مستخدم محدد' :
                           notification.target_type === 'topic' ? 'موضوع' : notification.target_type}
                        </div>
                        {notification.target_value && (
                          <div className="text-gray-500">{notification.target_value}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(notification.priority)}`}>
                        {notification.priority === 'high' ? 'عالية' :
                         notification.priority === 'normal' ? 'عادية' : 'منخفضة'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(notification.status)}`}>
                        {getStatusText(notification.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="space-y-1">
                        <div>مرسل: {notification.sent_count}</div>
                        <div>تم التسليم: {notification.delivered_count}</div>
                        <div>نقرات: {notification.clicked_count}</div>
                        {notification.failed_count > 0 && (
                          <div className="text-red-600">فشل: {notification.failed_count}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(notification.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {notification.status === 'pending' && (
                        <button
                          onClick={() => handleCancelNotification(notification.id)}
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
        </div>
      )}
    </div>
  );

  // عرض الأجهزة المسجلة
  const renderDevicesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">الأجهزة المسجلة ({devices.length})</h3>
        <div className="text-sm text-gray-500">
          آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">لا توجد أجهزة مسجلة</h3>
          <p className="text-gray-500">لم يتم تسجيل أي أجهزة للإشعارات بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الجهاز</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النوع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إصدار التطبيق</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">آخر ظهور</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devices.map(device => (
                  <tr key={device.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {device.user?.name || 'مستخدم غير معروف'}
                        </div>
                        <div className="text-gray-500">{device.user?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">{device.device_name || device.device_model}</div>
                        <div className="text-gray-500 font-mono text-xs">
                          {device.device_token.substring(0, 20)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg ml-2">{getDeviceTypeIcon(device.device_type)}</span>
                        <span className="text-sm">{device.device_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.app_version || 'غير معروف'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(device.last_seen_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        device.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {device.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewUserDevices(device.user_id)}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        عرض الأجهزة
                      </button>
                      <button
                        onClick={() => {
                          setSendForm({
                            ...sendForm,
                            target_type: 'user',
                            target_value: device.user_id
                          });
                          setShowSendModal(true);
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        إرسال إشعار
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

  if (loading) {
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
        <h2 className="text-2xl font-bold">إشعارات Firebase</h2>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-500">
            معدل التسليم: {stats.delivery_rate}%
          </div>
          <div className="text-sm text-gray-500">
            معدل النقر: {stats.click_rate}%
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('send')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === 'send'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Send className="w-4 h-4" />
              إرسال إشعار
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              السجل والإحصائيات
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === 'devices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              الأجهزة ({devices.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'send' && renderSendTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'devices' && renderDevicesTab()}
        </div>
      </div>

      {/* نموذج إرسال الإشعار */}
      <Dialog
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              إرسال إشعار Firebase
            </Dialog.Title>

            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عنوان الإشعار <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={sendForm.title}
                    onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="مثال: طلب جديد!"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نص الإشعار <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={sendForm.body}
                    onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                    placeholder="مثال: لديك طلب جديد في انتظار المعالجة"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع الهدف <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={sendForm.target_type}
                    onChange={(e) => setSendForm({ ...sendForm, target_type: e.target.value, target_value: '' })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="all">جميع المستخدمين</option>
                    <option value="user">مستخدم محدد</option>
                    <option value="topic">موضوع</option>
                  </select>
                </div>

                {sendForm.target_type === 'user' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المستخدم المستهدف <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={sendForm.target_value}
                      onChange={(e) => setSendForm({ ...sendForm, target_value: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                      placeholder="معرف المستخدم"
                      required
                    />
                  </div>
                )}

                {sendForm.target_type === 'topic' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الموضوع <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={sendForm.target_value}
                      onChange={(e) => setSendForm({ ...sendForm, target_value: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                      required
                    >
                      <option value="">اختر الموضوع</option>
                      <option value="vendors">البائعين</option>
                      <option value="drivers">السائقين</option>
                      <option value="customers">العملاء</option>
                      <option value="admins">المديرين</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الأولوية
                  </label>
                  <select
                    value={sendForm.priority}
                    onChange={(e) => setSendForm({ ...sendForm, priority: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="low">منخفضة</option>
                    <option value="normal">عادية</option>
                    <option value="high">عالية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    إجراء النقر
                  </label>
                  <select
                    value={sendForm.click_action}
                    onChange={(e) => setSendForm({ ...sendForm, click_action: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="FLUTTER_NOTIFICATION_CLICK">فتح التطبيق</option>
                    <option value="OPEN_ORDERS">فتح الطلبات</option>
                    <option value="OPEN_WALLET">فتح المحفظة</option>
                    <option value="OPEN_DELIVERIES">فتح التوصيلات</option>
                    <option value="OPEN_OFFERS">فتح العروض</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رابط الصورة
                  </label>
                  <input
                    type="url"
                    value={sendForm.image_url}
                    onChange={(e) => setSendForm({ ...sendForm, image_url: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSendNotification}
                  disabled={sending || !sendForm.title || !sendForm.body}
                  className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 ${
                    sending || !sendForm.title || !sendForm.body ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* نموذج عرض أجهزة المستخدم */}
      <Dialog
        open={showDevicesModal}
        onClose={() => {
          setShowDevicesModal(false);
          setSelectedUser(null);
          setUserDevices([]);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              أجهزة المستخدم
            </Dialog.Title>

            {userDevices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد أجهزة نشطة لهذا المستخدم
              </div>
            ) : (
              <div className="space-y-4">
                {userDevices.map(device => (
                  <div key={device.device_id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getDeviceTypeIcon(device.device_type)}</span>
                          <span className="font-medium">{device.device_type}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          إصدار التطبيق: {device.app_version || 'غير معروف'}
                        </div>
                        <div className="text-sm text-gray-500">
                          آخر ظهور: {formatDate(device.last_seen_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSendForm({
                            ...sendForm,
                            target_type: 'user',
                            target_value: selectedUser
                          });
                          setShowDevicesModal(false);
                          setShowSendModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        إرسال إشعار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDevicesModal(false);
                  setSelectedUser(null);
                  setUserDevices([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* دليل الاستخدام */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">كيفية عمل نظام إشعارات Firebase</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">📱 تسجيل الأجهزة</h4>
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
                <li>التطبيقات تسجل أجهزتها تلقائياً عند التشغيل</li>
                <li>يتم حفظ Device Token لكل جهاز</li>
                <li>تتبع آخر نشاط للجهاز</li>
                <li>دعم Android, iOS, والويب</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">🔔 أنواع الإشعارات</h4>
              <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                <li>إشعارات الطلبات الجديدة للبائعين</li>
                <li>إشعارات التوصيل للسائقين</li>
                <li>تحديثات حالة الطلب للعملاء</li>
                <li>إشعارات الدفع والمحفظة</li>
                <li>الإشعارات الترويجية</li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">🎯 الاستهداف</h4>
              <ul className="list-disc list-inside space-y-1 text-purple-700 text-sm">
                <li><strong>جميع المستخدمين:</strong> إرسال لكل الأجهزة النشطة</li>
                <li><strong>مستخدم محدد:</strong> إرسال لأجهزة مستخدم واحد</li>
                <li><strong>موضوع:</strong> إرسال لمجموعة (بائعين، سائقين، إلخ)</li>
                <li><strong>شروط مخصصة:</strong> استهداف متقدم</li>
              </ul>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">📊 التتبع والإحصائيات</h4>
              <ul className="list-disc list-inside space-y-1 text-orange-700 text-sm">
                <li>تتبع معدل التسليم والنقر</li>
                <li>سجل مفصل لكل إشعار</li>
                <li>إحصائيات الأجهزة النشطة</li>
                <li>تقارير الأداء</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-2">⚙️ إعداد Firebase</h4>
          <p className="text-yellow-700 text-sm">
            لتفعيل الإرسال الفعلي، تحتاج إلى:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-yellow-700 text-sm mt-2">
            <li>إنشاء مشروع Firebase وتفعيل Cloud Messaging</li>
            <li>الحصول على Server Key من إعدادات المشروع</li>
            <li>إضافة المفتاح إلى متغيرات البيئة في Supabase</li>
            <li>تحديث Edge Function لاستخدام Firebase Admin SDK</li>
          </ol>
        </div>
      </div>
    </div>
  );
}