import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationBeep, initAudioContext } from '../utils/notificationSound';
import { toast } from 'react-toastify';

export function usePendingOrderNotifications({ enabled = true }) {
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const lastOrderCountRef = useRef({
    orders: 0,
    captain_orders: 0,
    parcel_orders: 0
  });
  const isInitializedRef = useRef(false);
  const subscriptionsRef = useRef([]);
  const continuousSoundTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchNotificationSettings = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error getting user:', userError);
          setNotificationSettings({
            sound_enabled: true,
            browser_notifications_enabled: true,
            continuous_sound_enabled: true,
            auto_notifications_enabled: true,
            sound_repeat_interval_seconds: 30
          });
          return;
        }

        if (!user) {
          setNotificationSettings({
            sound_enabled: true,
            browser_notifications_enabled: true,
            continuous_sound_enabled: true,
            auto_notifications_enabled: true,
            sound_repeat_interval_seconds: 30
          });
          return;
        }

        const { data, error } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching notification settings:', error);
          setNotificationSettings({
            sound_enabled: true,
            browser_notifications_enabled: true,
            continuous_sound_enabled: true,
            auto_notifications_enabled: true,
            sound_repeat_interval_seconds: 30
          });
          return;
        }

        if (data) {
          setNotificationSettings(data);
        } else {
          setNotificationSettings({
            sound_enabled: true,
            browser_notifications_enabled: true,
            continuous_sound_enabled: true,
            auto_notifications_enabled: true,
            sound_repeat_interval_seconds: 30
          });
        }
      } catch (error) {
        console.error('Error in fetchNotificationSettings:', error);
        setNotificationSettings({
          sound_enabled: true,
          browser_notifications_enabled: true,
          continuous_sound_enabled: true,
          auto_notifications_enabled: true,
          sound_repeat_interval_seconds: 30
        });
      }
    };

    fetchNotificationSettings();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !notificationSettings) return;

    const checkAndNotify = async (tableName, orderType) => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']);

        if (error) {
          console.error(`❌ Error checking ${tableName}:`, error);
          throw error;
        }

        if (isInitializedRef.current) {
          const previousCount = lastOrderCountRef.current[orderType];

          if (count > previousCount) {
            const newOrdersCount = count - previousCount;
            console.log(`🔔 NEW: ${newOrdersCount} order(s) in ${tableName}`);

            if (notificationSettings.sound_enabled) {
              playNotificationBeep(1.0, 3);
            }

            if (notificationSettings.browser_notifications_enabled) {
              const orderTypeLabel =
                orderType === 'orders' ? 'طلبات المنتجات' :
                orderType === 'captain_orders' ? 'طلبات الكابتن' :
                'طلبات الطرود';

              toast.success(
                `🔔 ${newOrdersCount} طلب جديد في ${orderTypeLabel}`,
                {
                  position: 'top-center',
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                  className: 'bg-green-50 text-green-900 font-semibold',
                  progressClassName: 'bg-green-500',
                  icon: '🔔'
                }
              );

              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('طلب جديد', {
                  body: `لديك ${newOrdersCount} طلب جديد في ${orderTypeLabel}`,
                  icon: '/favicon.ico',
                  badge: '/favicon.ico',
                  tag: `new-order-${orderType}-${Date.now()}`,
                  requireInteraction: true
                });
              }
            }
          }
        }

        lastOrderCountRef.current[orderType] = count;
        return count;
      } catch (error) {
        console.error(`Error checking ${tableName}:`, error);
        return 0;
      }
    };

    const updateTotalPendingOrders = async () => {
      try {
        const counts = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
          supabase.from('captain_orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
          supabase.from('parcel_orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing'])
        ]);

        const total = (counts[0].count || 0) + (counts[1].count || 0) + (counts[2].count || 0);
        setTotalPendingOrders(total);
        return total;
      } catch (error) {
        console.error('Error updating total pending orders:', error);
        return 0;
      }
    };

    const checkContinuousSound = async () => {
      try {
        const total = await updateTotalPendingOrders();

        if (total > 0 && notificationSettings?.continuous_sound_enabled && notificationSettings?.sound_enabled && audioInitialized) {
          playNotificationBeep(1.0, 3);

          if (notificationSettings?.browser_notifications_enabled) {
            toast.warning(
              `⚠️ لديك ${total} طلب يحتاج انتباهك`,
              {
                position: 'top-center',
                autoClose: 4000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                className: 'bg-amber-50 text-amber-900 font-semibold',
                progressClassName: 'bg-amber-500',
                icon: '⚠️',
                toastId: 'pending-orders-reminder'
              }
            );
          }
        }
      } catch (error) {
        console.error('Error in checkContinuousSound:', error);
      }
    };

    const initializeCountsAndSubscribe = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Error getting user or user not logged in:', userError);
          return;
        }

      const counts = await Promise.all([
        checkAndNotify('orders', 'orders'),
        checkAndNotify('captain_orders', 'captain_orders'),
        checkAndNotify('parcel_orders', 'parcel_orders')
      ]);

      const initialTotal = (counts[0] || 0) + (counts[1] || 0) + (counts[2] || 0);
      setTotalPendingOrders(initialTotal);

      if (initialTotal > 0) {
        console.log(`🔔 Found ${initialTotal} pending/processing orders on initialization`);

        if (notificationSettings?.sound_enabled) {
          if (audioInitialized) {
            setTimeout(() => {
              playNotificationBeep(1.0, 3);
              console.log('🔊 Playing sound for existing orders');
            }, 500);
          } else {
            console.log('⚠️ Audio not initialized yet, attempting activation...');
            try {
              const context = initAudioContext();
              if (context) {
                context.resume().then(() => {
                  setAudioInitialized(true);
                  playNotificationBeep(1.0, 3);
                  console.log('🔊 Audio activated and sound played');
                }).catch(err => {
                  console.log('⚠️ Auto-activation failed, waiting for user interaction');
                });
              }
            } catch (err) {
              console.log('⚠️ Could not auto-activate audio');
            }
          }
        }

        if (notificationSettings?.browser_notifications_enabled) {
          toast.info(
            `📋 لديك ${initialTotal} طلب بحاجة لانتباهك`,
            {
              position: 'top-center',
              autoClose: 6000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              className: 'bg-blue-50 text-blue-900 font-semibold text-lg',
              progressClassName: 'bg-blue-500',
              icon: '📋'
            }
          );
        }
      }

      isInitializedRef.current = true;

      const ordersChannel = supabase
        .channel('pending-orders-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.pending'
          },
          async (payload) => {
            console.log('📬 Received INSERT event for orders (pending):', payload);
            await checkAndNotify('orders', 'orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.pending'
          },
          async () => {
            await checkAndNotify('orders', 'orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.processing'
          },
          async (payload) => {
            console.log('📬 Received INSERT event for orders (processing):', payload);
            await checkAndNotify('orders', 'orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.processing'
          },
          async (payload) => {
            console.log('📬 Received UPDATE event for orders (processing):', payload);
            await checkAndNotify('orders', 'orders');
            await updateTotalPendingOrders();
          }
        )
        .subscribe((status) => {
          console.log('📡 Orders channel subscription status:', status);
        });

      const captainOrdersChannel = supabase
        .channel('pending-captain-orders-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'captain_orders',
            filter: 'status=eq.pending'
          },
          async () => {
            await checkAndNotify('captain_orders', 'captain_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'captain_orders',
            filter: 'status=eq.pending'
          },
          async () => {
            await checkAndNotify('captain_orders', 'captain_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'captain_orders',
            filter: 'status=eq.processing'
          },
          async () => {
            await checkAndNotify('captain_orders', 'captain_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'captain_orders',
            filter: 'status=eq.processing'
          },
          async () => {
            await checkAndNotify('captain_orders', 'captain_orders');
            await updateTotalPendingOrders();
          }
        )
        .subscribe();

      const parcelOrdersChannel = supabase
        .channel('pending-parcel-orders-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'parcel_orders',
            filter: 'status=eq.pending'
          },
          async () => {
            await checkAndNotify('parcel_orders', 'parcel_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'parcel_orders',
            filter: 'status=eq.pending'
          },
          async () => {
            await checkAndNotify('parcel_orders', 'parcel_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'parcel_orders',
            filter: 'status=eq.processing'
          },
          async () => {
            await checkAndNotify('parcel_orders', 'parcel_orders');
            await updateTotalPendingOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'parcel_orders',
            filter: 'status=eq.processing'
          },
          async () => {
            await checkAndNotify('parcel_orders', 'parcel_orders');
            await updateTotalPendingOrders();
          }
        )
        .subscribe();

      subscriptionsRef.current = [ordersChannel, captainOrdersChannel, parcelOrdersChannel];

      if (notificationSettings?.continuous_sound_enabled && initialTotal > 0) {
        const interval = (notificationSettings?.sound_repeat_interval_seconds || 30) * 1000;
        console.log(`🔄 Starting continuous sound with ${interval}ms interval`);
        continuousSoundTimerRef.current = setInterval(checkContinuousSound, interval);
      }
      } catch (error) {
        console.error('Error in initializeCountsAndSubscribe:', error);
      }
    };

    initializeCountsAndSubscribe();

    return () => {
      console.log('🧹 Cleaning up subscriptions');
      subscriptionsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      subscriptionsRef.current = [];
      isInitializedRef.current = false;

      if (continuousSoundTimerRef.current) {
        clearInterval(continuousSoundTimerRef.current);
        continuousSoundTimerRef.current = null;
      }
    };
  }, [enabled, notificationSettings]);

  useEffect(() => {
    if (!enabled || !notificationSettings?.browser_notifications_enabled) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled, notificationSettings]);

  const activateAudio = async () => {
    try {
      const context = initAudioContext();
      if (!context) {
        console.warn('Audio context not available');
        return;
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      setAudioInitialized(true);
      console.log('🔊 Audio context activated successfully');

      if (totalPendingOrders > 0) {
        setTimeout(() => {
          playNotificationBeep(1.0, 3);
          console.log('🔔 Playing notification sound for pending orders');
        }, 100);
      }
    } catch (error) {
      console.error('Failed to activate audio:', error);
    }
  };

  return {
    notificationSettings,
    totalPendingOrders,
    audioInitialized,
    activateAudio
  };
}
