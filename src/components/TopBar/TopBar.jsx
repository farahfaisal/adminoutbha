import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import {
  getUserPaymentNotifications,
  getUnreadNotificationsCount as getPaymentUnreadCount,
  markNotificationAsRead as markPaymentAsRead
} from '../../lib/paymentNotificationsApi';
import { formatDate } from '../../utils/formatters';
import NotificationManager from '../NotificationManager';

export default function TopBar() {
  const { settings } = useSettings();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [paymentNotifications, setPaymentNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [paymentUnreadCount, setPaymentUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'payments'
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    continuousSound: true,
    browser: true
  });
  const audioRef = useRef(null);
  const continuousSoundIntervalRef = useRef(null);
  const settingsRef = useRef(settings);

  // Keep settings ref updated
  useEffect(() => {
    settingsRef.current = settings;
    console.log('Settings updated in TopBar:', {
      autoProcessing: settings?.orders?.autoProcessing,
      allOrderSettings: settings?.orders
    });
  }, [settings]);

  // Load notifications and set up real-time subscription
  useEffect(() => {
    fetchNotifications();
    fetchPaymentNotifications();
    loadNotificationSettings();
    
    // Initialize audio using Web Audio API (no external file needed)
    if (!audioRef.current) {
      // Create a simple beep sound programmatically
      audioRef.current = {
        currentTime: 0,
        play: () => {
          return new Promise((resolve, reject) => {
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);

              oscillator.frequency.value = 800; // Frequency in Hz
              oscillator.type = 'sine';

              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.5);

              resolve();
            } catch (err) {
              reject(err);
            }
          });
        }
      };
    }
    
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

    // Set up real-time subscription for captain orders
    const captainOrdersSubscription = supabase
      .channel('captain-orders-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'captain_orders'
      }, handleNewCaptainOrder)
      .subscribe();

    // Set up real-time subscription for parcel orders
    const parcelOrdersSubscription = supabase
      .channel('parcel-orders-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'parcel_orders'
      }, handleNewParcelOrder)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(statusSubscription);
      supabase.removeChannel(captainOrdersSubscription);
      supabase.removeChannel(parcelOrdersSubscription);

      // Clean up continuous sound interval
      if (continuousSoundIntervalRef.current) {
        clearInterval(continuousSoundIntervalRef.current);
      }
    };
  }, []);

  const loadNotificationSettings = async () => {
    try {
      if (!user?.id) {
        // إذا لم يكن هناك مستخدم، استخدم الإعدادات الافتراضية
        setNotificationSettings({
          sound: true,
          continuousSound: true,
          browser: true
        });
        return;
      }

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification settings:', error);
      }

      if (data) {
        setNotificationSettings({
          sound: data.sound_enabled ?? true,
          continuousSound: data.continuous_sound_enabled ?? true,
          browser: data.browser_notifications_enabled ?? true
        });
      } else {
        // إذا لم توجد إعدادات محفوظة، استخدم الإعدادات الافتراضية (الصوت مفعل)
        setNotificationSettings({
          sound: true,
          continuousSound: true,
          browser: true
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      setNotificationSettings({
        sound: true,
        continuousSound: true,
        browser: true
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      // Fetch recent notifications
      const { data, error } = await supabase
        .from('order_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(data || []);

      // Count unread notifications
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchPaymentNotifications = async () => {
    if (!user?.id) return;

    try {
      const data = await getUserPaymentNotifications(user.id, {
        limit: 10,
        offset: 0
      });

      setPaymentNotifications(data || []);

      const count = await getPaymentUnreadCount(user.id);
      setPaymentUnreadCount(count);
    } catch (error) {
      console.error('Error fetching payment notifications:', error);
    }
  };

  const handleNewOrder = (payload) => {
    const newOrder = payload.new;

    // Check if auto-processing is enabled - use ref for latest value
    const currentSettings = settingsRef.current;
    const autoProcessingEnabled = currentSettings?.orders?.autoProcessing || false;

    console.log('New order received:', {
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      status: newOrder.status,
      autoProcessingEnabled,
      settings: currentSettings?.orders
    });

    if (autoProcessingEnabled && newOrder.status === 'pending') {
      // Auto-process the order
      console.log('Auto-processing order:', newOrder.id);
      processOrderAutomatically(newOrder);
    } else if (newOrder.status === 'pending') {
      // Add notification to state
      const notification = {
        id: crypto.randomUUID(),
        title: 'طلب جديد',
        message: `تم استلام طلب جديد ${newOrder.order_number || newOrder.id.substring(0, 8)}`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: newOrder.id
      };
      
      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Save notification to database
      saveNotification(notification);
      
      // Show toast notification
      toast.info(notification.message);
      
      // Play sound notification if enabled
      if (notificationSettings.sound) {
        playNotificationSound();
      }
      
      // Start continuous sound if enabled
      if (notificationSettings.continuousSound) {
        startContinuousSound();
      }
      
      // Show browser notification if enabled
      if (notificationSettings.browser) {
        showBrowserNotification(notification.title, notification.message);
      }
    }
  };
  
  const processOrderAutomatically = async (order) => {
    try {
      console.log('Processing order automatically:', order.id);
      
      // Step 1: Accept the order
      const { error: acceptError } = await supabase
        .from('orders')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (acceptError) {
        console.error('Error accepting order automatically:', acceptError);
        return;
      }
      
      // Step 2: Add status history for acceptance
      await supabase
        .from('order_status_history')
        .insert([{
          order_id: order.id,
          status: 'accepted',
          note: 'تم قبول الطلب تلقائياً',
          created_by: user?.id
        }]);
      
      // Step 3: Update to processing status
      const { error: processingError } = await supabase
        .from('orders')
        .update({ 
          status: 'processing',
          preparation_time: settings?.orders?.defaultPreparationTime || 15,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (processingError) {
        console.error('Error updating order to processing:', processingError);
        return;
      }
      
      // Step 4: Add status history for processing
      await supabase
        .from('order_status_history')
        .insert([{
          order_id: order.id,
          status: 'processing',
          note: 'تم بدء تحضير الطلب تلقائياً',
          created_by: user?.id
        }]);
      
      // Step 5: Get vendor ID for the order
      let vendorId = order.vendor_id;
      
      if (!vendorId && order.vendor_name) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id')
          .eq('store_name', order.vendor_name)
          .single();
        
        vendorId = vendorData?.id;
      }
      
      if (!vendorId) {
        console.error('Could not find vendor ID for auto-processing');
        return;
      }
      
      // Step 6: Add to driver waiting list
      const { error: waitingListError } = await supabase
        .from('driver_waiting_list')
        .insert([{
          order_id: order.id,
          vendor_id: vendorId,
          status: 'pending',
          customer_name: order.customer_name || '',
          customer_phone: order.customer_phone || '',
          address: order.address || '',
          total: order.total || 0,
          notes: order.notes || 'معالجة تلقائية',
          expires_at: new Date(Date.now() + 30 * 60000).toISOString() // 30 minutes
        }]);
      
      if (waitingListError) {
        console.error('Error adding to waiting list automatically:', waitingListError);
        return;
      }
      
      // Step 7: Update order status to waiting-for-driver
      await supabase
        .from('orders')
        .update({ 
          status: 'waiting-for-driver',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      // Step 8: Add final status history
      await supabase
        .from('order_status_history')
        .insert([{
          order_id: order.id,
          status: 'waiting-for-driver',
          note: 'تم إضافة الطلب لقائمة انتظار السائقين تلقائياً',
          created_by: user?.id
        }]);
      
      // Step 9: Show success notification
      const notification = {
        id: crypto.randomUUID(),
        title: 'تمت معالجة طلب تلقائياً',
        message: `تم قبول ومعالجة الطلب ${order.order_number || order.id.substring(0, 8)} تلقائياً وإضافته لقائمة انتظار السائقين`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: order.id
      };
      
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      saveNotification(notification);
      
      toast.success('تم معالجة الطلب تلقائياً وإضافته لقائمة انتظار السائقين');
      
      // Notify drivers if enabled
      if (settings?.orders?.notifyDrivers) {
        // Play sound for drivers waiting list
        if (notificationSettings.sound) {
          playNotificationSound();
        }
        
        if (notificationSettings.continuousSound) {
          startContinuousSound();
        }
      }
      
    } catch (error) {
      console.error('Error in automatic order processing:', error);
      toast.error('فشل في المعالجة التلقائية للطلب');
    }
  };

  const handleNewCaptainOrder = (payload) => {
    const newOrder = payload.new;

    // Check if auto-processing is enabled - use ref for latest value
    const currentSettings = settingsRef.current;
    const autoProcessingEnabled = currentSettings?.orders?.autoProcessing || false;

    console.log('New captain order received:', {
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      status: newOrder.status,
      autoProcessingEnabled,
      settings: currentSettings?.orders
    });

    if (autoProcessingEnabled && newOrder.status === 'pending') {
      // Auto-process the captain order
      console.log('Auto-processing captain order:', newOrder.id);
      processCaptainOrderAutomatically(newOrder);
    } else if (newOrder.status === 'pending') {
      // Add notification to state
      const notification = {
        id: crypto.randomUUID(),
        title: 'طلب كابتن جديد',
        message: `تم استلام طلب كابتن جديد ${newOrder.order_number || newOrder.id.substring(0, 8)}`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: newOrder.id
      };

      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Save notification to database
      saveNotification(notification);

      // Show toast notification
      toast.info(notification.message);

      // Play sound notification if enabled
      if (notificationSettings.sound) {
        playNotificationSound();
      }

      // Start continuous sound if enabled
      if (notificationSettings.continuousSound) {
        startContinuousSound();
      }

      // Show browser notification if enabled
      if (notificationSettings.browser) {
        showBrowserNotification(notification.title, notification.message);
      }
    }
  };

  const processCaptainOrderAutomatically = async (order) => {
    try {
      console.log('Processing captain order automatically:', order.id);

      // Step 1: Accept the order
      const { error: acceptError } = await supabase
        .from('captain_orders')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (acceptError) {
        console.error('Error accepting captain order automatically:', acceptError);
        return;
      }

      // Step 2: Add status history for acceptance
      await supabase
        .from('captain_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'accepted',
          note: 'تم قبول الطلب تلقائياً',
          created_by: user?.id
        }]);

      // Step 3: Update to processing status
      const { error: processingError } = await supabase
        .from('captain_orders')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (processingError) {
        console.error('Error updating captain order to processing:', processingError);
        return;
      }

      // Step 4: Add status history for processing
      await supabase
        .from('captain_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'processing',
          note: 'تم بدء معالجة الطلب تلقائياً',
          created_by: user?.id
        }]);

      // Step 5: Update to waiting-for-driver status
      await supabase
        .from('captain_orders')
        .update({
          status: 'waiting-for-driver',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // Step 6: Add final status history
      await supabase
        .from('captain_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'waiting-for-driver',
          note: 'تم تجهيز الطلب للسائقين تلقائياً',
          created_by: user?.id
        }]);

      // Step 7: Show success notification
      const notification = {
        id: crypto.randomUUID(),
        title: 'تمت معالجة طلب كابتن تلقائياً',
        message: `تم قبول ومعالجة طلب الكابتن ${order.order_number || order.id.substring(0, 8)} تلقائياً`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: order.id
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      saveNotification(notification);

      toast.success('تم معالجة طلب الكابتن تلقائياً');

      // Notify drivers if enabled
      if (settings?.orders?.notifyDrivers) {
        // Play sound for drivers
        if (notificationSettings.sound) {
          playNotificationSound();
        }

        if (notificationSettings.continuousSound) {
          startContinuousSound();
        }
      }

    } catch (error) {
      console.error('Error in automatic captain order processing:', error);
      toast.error('فشل في المعالجة التلقائية لطلب الكابتن');
    }
  };

  const handleNewParcelOrder = (payload) => {
    const newOrder = payload.new;

    // Check if auto-processing is enabled - use ref for latest value
    const currentSettings = settingsRef.current;
    const autoProcessingEnabled = currentSettings?.orders?.autoProcessing || false;

    console.log('New parcel order received:', {
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      status: newOrder.status,
      autoProcessingEnabled,
      settings: currentSettings?.orders
    });

    if (autoProcessingEnabled && newOrder.status === 'pending') {
      // Auto-process the parcel order
      console.log('Auto-processing parcel order:', newOrder.id);
      processParcelOrderAutomatically(newOrder);
    } else if (newOrder.status === 'pending') {
      // Add notification to state
      const notification = {
        id: crypto.randomUUID(),
        title: 'طلب شحن جديد',
        message: `تم استلام طلب شحن جديد ${newOrder.order_number || newOrder.id.substring(0, 8)}`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: newOrder.id
      };

      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Save notification to database
      saveNotification(notification);

      // Show toast notification
      toast.info(notification.message);

      // Play sound notification if enabled
      if (notificationSettings.sound) {
        playNotificationSound();
      }

      // Start continuous sound if enabled
      if (notificationSettings.continuousSound) {
        startContinuousSound();
      }

      // Show browser notification if enabled
      if (notificationSettings.browser) {
        showBrowserNotification(notification.title, notification.message);
      }
    }
  };

  const processParcelOrderAutomatically = async (order) => {
    try {
      console.log('Processing parcel order automatically:', order.id);

      // Step 1: Accept the order
      const { error: acceptError } = await supabase
        .from('parcel_orders')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (acceptError) {
        console.error('Error accepting parcel order automatically:', acceptError);
        return;
      }

      // Step 2: Add status history for acceptance
      await supabase
        .from('parcel_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'accepted',
          note: 'تم قبول الطلب تلقائياً',
          created_by: user?.id
        }]);

      // Step 3: Update to processing status
      const { error: processingError } = await supabase
        .from('parcel_orders')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (processingError) {
        console.error('Error updating parcel order to processing:', processingError);
        return;
      }

      // Step 4: Add status history for processing
      await supabase
        .from('parcel_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'processing',
          note: 'تم بدء معالجة الطلب تلقائياً',
          created_by: user?.id
        }]);

      // Step 5: Update to waiting-for-driver status
      await supabase
        .from('parcel_orders')
        .update({
          status: 'waiting-for-driver',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // Step 6: Add final status history
      await supabase
        .from('parcel_order_status_history')
        .insert([{
          order_id: order.id,
          status: 'waiting-for-driver',
          note: 'تم تجهيز الطلب للسائقين تلقائياً',
          created_by: user?.id
        }]);

      // Step 7: Show success notification
      const notification = {
        id: crypto.randomUUID(),
        title: 'تمت معالجة طلب شحن تلقائياً',
        message: `تم قبول ومعالجة طلب الشحن ${order.order_number || order.id.substring(0, 8)} تلقائياً`,
        time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        order_id: order.id
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      saveNotification(notification);

      toast.success('تم معالجة طلب الشحن تلقائياً');

      // Notify drivers if enabled
      if (settings?.orders?.notifyDrivers) {
        // Play sound for drivers
        if (notificationSettings.sound) {
          playNotificationSound();
        }

        if (notificationSettings.continuousSound) {
          startContinuousSound();
        }
      }

    } catch (error) {
      console.error('Error in automatic parcel order processing:', error);
      toast.error('فشل في المعالجة التلقائية لطلب الشحن');
    }
  };

  const handleStatusChange = (payload) => {
    const statusChange = payload.new;
    
    // Only notify for specific status changes
    if (['pending', 'waiting-for-driver'].includes(statusChange.status)) {
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
            case 'waiting-for-driver':
              title = 'طلب بانتظار سائق';
              message = `الطلب ${order.order_number || order.id.substring(0, 8)} بانتظار سائق`;
              
              // Play sound for orders waiting for driver
              if (notificationSettings.sound) {
                playNotificationSound();
              }
              
              // Start continuous sound if enabled
              if (notificationSettings.continuousSound) {
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
            is_read: false,
            order_id: order.id
          };
          
          // Add to notifications list
          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Save notification to database
          saveNotification(notification);
          
          // Show toast notification
          toast.info(notification.message);
          
          // Show browser notification if enabled
          if (notificationSettings.browser) {
            showBrowserNotification(notification.title, notification.message);
          }
        });
    }
  };
  
  const saveNotification = async (notification) => {
    try {
      await supabase
        .from('order_notifications')
        .insert([{
          order_id: notification.order_id,
          message: notification.message,
          is_read: false,
          created_by: user?.id
        }]);
    } catch (error) {
      console.error('Error saving notification:', error);
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
  
  const requestBrowserNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error('المتصفح لا يدعم الإشعارات');
      return false;
    }

    if (Notification.permission === 'denied') {
      toast.error('تم رفض الإشعارات سابقاً. يرجى السماح بها من إعدادات المتصفح', {
        autoClose: 8000,
        position: 'top-center'
      });

      setTimeout(() => {
        toast.info('انقر على أيقونة القفل 🔒 بجانب عنوان الموقع وغيّر إعدادات الإشعارات', {
          autoClose: 10000,
          position: 'top-center'
        });
      }, 1000);

      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    try {
      const result = await Notification.requestPermission();

      if (result === 'granted') {
        toast.success('تم تفعيل الإشعارات بنجاح ✓');

        new Notification('الإشعارات مفعّلة!', {
          body: 'سيتم إشعارك عند وصول طلبات جديدة',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });

        return true;
      } else if (result === 'denied') {
        toast.error('تم رفض الإشعارات. يرجى السماح بها من إعدادات المتصفح');
        return false;
      } else {
        toast.warning('لم يتم منح الإذن للإشعارات');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('حدث خطأ أثناء طلب الإذن');
      return false;
    }
  };

  const showBrowserNotification = (title, message) => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: '/logo.svg'
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
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getPaymentIcon = (type) => {
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
      default:
        return '💰';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 shadow-sm fixed top-0 left-0 right-0 z-30 md:relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Search Bar - Hidden on mobile */}
          <div className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="بحث..."
                className="block w-full bg-slate-800 text-white rounded-lg border-gray-700 pr-10 focus:border-red-500 focus:ring-red-500 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Mobile Logo/Title */}
          <div className="flex md:hidden items-center">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
              🛒
            </div>
            <h2 className="mr-2 text-sm font-bold text-white">
              اطلبها
            </h2>
          </div>

          {/* Right Side Items */}
          <div className="flex items-center space-x-2 md:space-x-4 space-x-reverse">
            {/* Notification Manager - Sound & Web Notifications */}
            <NotificationManager enabled={true} />

            {/* Auto Processing Indicator */}
            {settings?.orders?.autoProcessing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-700/50 rounded-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-green-300">معالجة تلقائية</span>
              </div>
            )}

            {/* Unified Notifications */}
            <div className="relative">
              <button
                onClick={async () => {
                  await requestBrowserNotificationPermission();
                  setShowNotifications(!showNotifications);
                }}
                className="relative p-2 text-gray-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {(unreadCount + paymentUnreadCount) > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-500 rounded-full ring-2 ring-slate-900">
                    {(unreadCount + paymentUnreadCount) > 99 ? '99+' : (unreadCount + paymentUnreadCount)}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute left-0 mt-2 w-96 bg-slate-800 rounded-lg shadow-lg py-1 z-50 border border-slate-700">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-white">الإشعارات</h3>
                      <button
                        onClick={stopContinuousSound}
                        className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded bg-red-900/30"
                      >
                        إيقاف الصوت
                      </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                          activeTab === 'orders'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        }`}
                      >
                        الطلبات
                        {unreadCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                          activeTab === 'payments'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        }`}
                      >
                        المدفوعات
                        {paymentUnreadCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            {paymentUnreadCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Orders Tab Content */}
                  {activeTab === 'orders' && (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-gray-400 text-center">
                          <svg className="h-12 w-12 mx-auto mb-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p>لا توجد إشعارات</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 ${
                              !notification.is_read ? 'bg-slate-700/50 border-l-4 border-l-blue-500' : ''
                            }`}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <p className="text-sm text-gray-200 font-medium">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Payments Tab Content */}
                  {activeTab === 'payments' && (
                    <div className="max-h-96 overflow-y-auto">
                      {paymentNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-gray-400 text-center">
                          <svg className="h-12 w-12 mx-auto mb-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p>لا توجد إشعارات دفع</p>
                        </div>
                      ) : (
                        paymentNotifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 ${
                              notification.status === 'unread' ? 'bg-slate-700/50 border-l-4 border-l-green-500' : ''
                            }`}
                            onClick={async () => {
                              if (notification.status === 'unread') {
                                await markPaymentAsRead(notification.id);
                                setPaymentNotifications(prev =>
                                  prev.map(n => n.id === notification.id ? { ...n, status: 'read' } : n)
                                );
                                setPaymentUnreadCount(prev => Math.max(0, prev - 1));
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{getPaymentIcon(notification.notification_type)}</span>
                              <div className="flex-1">
                                <p className="text-sm text-gray-200 font-medium">{notification.title}</p>
                                <p className="text-xs text-gray-400 mt-1">{notification.message}</p>
                                {notification.amount && (
                                  <div className="mt-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-300">
                                      ₪{parseFloat(notification.amount).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{formatDate(notification.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="px-4 py-2 border-t border-slate-700">
                    <button 
                      className="text-sm text-red-400 hover:text-red-300"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/admin-dashboard/notifications');
                      }}
                    >
                      عرض كل الإشعارات
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center"
              >
                <div className="h-8 w-8 rounded-full border-2 border-red-500 overflow-hidden bg-slate-700 flex items-center justify-center">
                  <span className="text-lg text-slate-300">👤</span>
                </div>
                <span className="mr-2 text-sm font-medium text-gray-200">{user?.name || settings.store.name}</span>
              </button>
              
              {showUserMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg py-1 z-50 border border-slate-700">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="text-sm font-semibold text-white">{user?.email || 'admin@example.com'}</p>
                    <p className="text-xs text-gray-400">{user?.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</p>
                  </div>
                  <button 
                    onClick={() => navigate('/admin-dashboard/settings')}
                    className="block w-full text-right px-4 py-2 text-sm text-gray-200 hover:bg-slate-700"
                  >
                    الإعدادات
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-right px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}