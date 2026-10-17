import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setNotificationSettings] = useState({
    sound: true,
    continuousSound: true,
    browser: true,
    push: true,
    auto: true
  });
  const audioRef = useRef(null);
  const continuousSoundIntervalRef = useRef(null);
  const { settings: globalSettings } = useSettings();
  
  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_settings')
          .select('*')
          .maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          setNotificationSettings({
            sound: data.sound_enabled ?? true,
            continuousSound: data.continuous_sound_enabled ?? true,
            browser: data.browser_notifications_enabled ?? true,
            push: data.push_notifications_enabled ?? true,
            auto: data.auto_notifications_enabled ?? true
          });
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    
    loadSettings();
    
    // Initialize audio element
    if (!audioRef.current) {
      audioRef.current = new Audio('/notification.mp3');
      audioRef.current.volume = 0.7;
    }
    
    return () => {
      // Clean up continuous sound interval
      if (continuousSoundIntervalRef.current) {
        clearInterval(continuousSoundIntervalRef.current);
      }
    };
  }, []);
  
  // Load notifications and set up real-time subscription
  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription for new orders
    const ordersSubscription = supabase
      .channel('orders-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, handleNewOrder)
      .subscribe();
    
    // Set up real-time subscription for order status changes
    const statusSubscription = supabase
      .channel('order-status-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_status_history'
      }, handleStatusChange)
      .subscribe();
    
    return () => {
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(statusSubscription);
      
      // Clean up continuous sound interval
      if (continuousSoundIntervalRef.current) {
        clearInterval(continuousSoundIntervalRef.current);
      }
    };
  }, [settings]);
  
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // Fetch recent notifications
      const { data, error } = await supabase
        .from('order_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      setNotifications(data || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('فشل في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNewOrder = (payload) => {
    const newOrder = payload.new;
    
    // Add notification to state
    const notification = {
      id: crypto.randomUUID(),
      title: 'طلب جديد',
      message: `تم استلام طلب جديد ${newOrder.order_number || newOrder.id.substring(0, 8)}`,
      time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      type: 'new_order',
      order_id: newOrder.id
    };
    
    setNotifications(prev => [notification, ...prev]);
    
    // Show toast notification
    toast.info(notification.message);
    
    // Play sound notification if enabled
    if (settings.sound) {
      playNotificationSound();
    }
    
    // Start continuous sound if enabled and order is not assigned
    if (settings.continuousSound && newOrder.status === 'pending') {
      startContinuousSound();
    }
    
    // Show browser notification if enabled
    if (settings.browser) {
      showBrowserNotification(notification.title, notification.message);
    }
  };
  
  const handleStatusChange = (payload) => {
    const statusChange = payload.new;
    
    // Only notify for specific status changes
    if (['pending', 'accepted', 'rejected', 'waiting-for-driver'].includes(statusChange.status)) {
      // Get order details
      supabase
        .from('orders')
        .select('id, order_number, customer_name')
        .eq('id', statusChange.order_id)
        .single()
        .then(({ data: order, error }) => {
          if (error || !order) return;
          
          // Create notification message based on status
          let title, message;
          switch (statusChange.status) {
            case 'pending':
              title = 'طلب جديد';
              message = `تم استلام طلب جديد ${order.order_number || order.id.substring(0, 8)}`;
              break;
            case 'accepted':
              title = 'تم قبول الطلب';
              message = `تم قبول الطلب ${order.order_number || order.id.substring(0, 8)}`;
              break;
            case 'rejected':
              title = 'تم رفض الطلب';
              message = `تم رفض الطلب ${order.order_number || order.id.substring(0, 8)}`;
              break;
            case 'waiting-for-driver':
              title = 'طلب بانتظار سائق';
              message = `الطلب ${order.order_number || order.id.substring(0, 8)} بانتظار سائق`;
              
              // Play sound for orders waiting for driver
              if (settings.sound) {
                playNotificationSound();
              }
              
              // Start continuous sound if enabled
              if (settings.continuousSound) {
                startContinuousSound();
              }
              break;
            default:
              return; // Don't notify for other statuses
          }
          
          // Add notification to state
          const notification = {
            id: crypto.randomUUID(),
            title,
            message,
            time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
            read: false,
            type: `status_${statusChange.status}`,
            order_id: order.id
          };
          
          setNotifications(prev => [notification, ...prev]);
          
          // Show toast notification
          toast.info(notification.message);
          
          // Show browser notification if enabled
          if (settings.browser) {
            showBrowserNotification(notification.title, notification.message);
          }
        });
    }
  };
  
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Error playing notification sound:', err));
    }
  };
  
  const startContinuousSound = () => {
    // Clear any existing interval
    if (continuousSoundIntervalRef.current) {
      clearInterval(continuousSoundIntervalRef.current);
    }
    
    // Play sound immediately
    playNotificationSound();
    
    // Set up interval to play sound every 10 seconds
    continuousSoundIntervalRef.current = setInterval(() => {
      playNotificationSound();
    }, 10000); // 10 seconds
    
    // Stop continuous sound after 2 minutes
    setTimeout(() => {
      if (continuousSoundIntervalRef.current) {
        clearInterval(continuousSoundIntervalRef.current);
        continuousSoundIntervalRef.current = null;
      }
    }, 120000); // 2 minutes
  };
  
  const stopContinuousSound = () => {
    if (continuousSoundIntervalRef.current) {
      clearInterval(continuousSoundIntervalRef.current);
      continuousSoundIntervalRef.current = null;
    }
  };
  
  const showBrowserNotification = (title, message) => {
    // Check if browser notifications are supported
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }
    
    // Check if permission is already granted
    if (Notification.permission === "granted") {
      new Notification(title, { 
        body: message,
        icon: '/logo.svg'
      });
    }
    // Otherwise, request permission
    else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { 
            body: message,
            icon: '/logo.svg'
          });
        }
      });
    }
  };
  
  const markAsRead = async (notificationId) => {
    try {
      // Update notification in database
      const { error } = await supabase
        .from('order_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('فشل في تحديث حالة الإشعار');
    }
  };
  
  const markAllAsRead = async () => {
    try {
      // Update all notifications in database
      const { error } = await supabase
        .from('order_notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      
      toast.success('تم تحديث جميع الإشعارات كمقروءة');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('فشل في تحديث حالة الإشعارات');
    }
  };
  
  const saveSettings = async () => {
    try {
      // Check if settings record exists
      const { data, error: fetchError } = await supabase
        .from('notification_settings')
        .select('id')
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (data) {
        // Update existing settings
        const { error } = await supabase
          .from('notification_settings')
          .update({
            sound_enabled: settings.sound,
            continuous_sound_enabled: settings.continuousSound,
            browser_notifications_enabled: settings.browser,
            push_notifications_enabled: settings.push,
            auto_notifications_enabled: settings.auto
          })
          .eq('id', data.id);
        
        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from('notification_settings')
          .insert([{
            user_id: globalSettings?.user?.id,
            sound_enabled: settings.sound,
            continuous_sound_enabled: settings.continuousSound,
            browser_notifications_enabled: settings.browser,
            push_notifications_enabled: settings.push,
            auto_notifications_enabled: settings.auto
          }]);
        
        if (error) throw error;
      }
      
      toast.success('تم حفظ إعدادات الإشعارات بنجاح');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('فشل في حفظ إعدادات الإشعارات');
    }
  };
  
  const handleSettingChange = (setting, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };
  
  // Test notification sound
  const testSound = () => {
    playNotificationSound();
  };
  
  // Test continuous sound
  const testContinuousSound = () => {
    if (continuousSoundIntervalRef.current) {
      stopContinuousSound();
      toast.info('تم إيقاف الصوت المستمر');
    } else {
      startContinuousSound();
      toast.info('تم تشغيل الصوت المستمر (سيتوقف تلقائيًا بعد دقيقتين)');
    }
  };
  
  // Test browser notification
  const testBrowserNotification = () => {
    showBrowserNotification('اختبار الإشعارات', 'هذا اختبار للإشعارات المتصفح');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">الإشعارات</h2>
        <div className="flex space-x-2">
          <button
            onClick={markAllAsRead}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            تحديث الكل كمقروء
          </button>
          <button
            onClick={stopContinuousSound}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            إيقاف الصوت
          </button>
        </div>
      </div>
      
      {/* Notification Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">إعدادات الإشعارات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">الإشعارات الصوتية</h4>
                <p className="text-sm text-gray-500">تشغيل صوت عند وصول إشعار جديد</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) => handleSettingChange('sound', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">الصوت المستمر للطلبات الجديدة</h4>
                <p className="text-sm text-gray-500">تشغيل صوت متكرر للطلبات الجديدة حتى يتم معالجتها</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.continuousSound}
                  onChange={(e) => handleSettingChange('continuousSound', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">إشعارات المتصفح</h4>
                <p className="text-sm text-gray-500">عرض إشعارات على سطح المكتب</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.browser}
                  onChange={(e) => handleSettingChange('browser', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">إشعارات الدفع</h4>
                <p className="text-sm text-gray-500">إرسال إشعارات للهاتف المحمول (يتطلب تثبيت التطبيق)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.push}
                  onChange={(e) => handleSettingChange('push', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">الإشعارات التلقائية</h4>
                <p className="text-sm text-gray-500">إرسال إشعارات تلقائية للطلبات الجديدة والتغييرات</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto}
                  onChange={(e) => handleSettingChange('auto', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <button
                onClick={testSound}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                اختبار الصوت
              </button>
              <button
                onClick={testContinuousSound}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                اختبار الصوت المستمر
              </button>
              <button
                onClick={testBrowserNotification}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                اختبار إشعار المتصفح
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">قائمة الإشعارات</h3>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-lg text-red-800">
            <p>{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد إشعارات
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${notification.read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{notification.title}</h4>
                    <p className="text-gray-600 mt-1">{notification.message}</p>
                  </div>
                  <span className="text-sm text-gray-500">{notification.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}