import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { playNotificationBeep } from '../utils/notificationSound';
import { toast } from 'react-toastify';

export default function NotificationManager({ enabled = true }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [permission, setPermission] = useState(Notification.permission);

  useEffect(() => {
    const savedSoundPref = localStorage.getItem('soundEnabled');
    if (savedSoundPref !== null) {
      setSoundEnabled(JSON.parse(savedSoundPref));
    }

    const savedNotifPref = localStorage.getItem('notificationsEnabled');
    if (savedNotifPref !== null) {
      setNotificationsEnabled(JSON.parse(savedNotifPref));
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      playNotificationBeep(1.0, 3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [soundEnabled]);

  const showWebNotification = useCallback((data) => {
    if (!notificationsEnabled || permission !== 'granted') return;

    const title = 'طلب جديد في قائمة الانتظار!';
    const options = {
      body: `عدد الطلبات في الانتظار: ${data.count}`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'new-order',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      silent: false
    };

    try {
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 10000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [notificationsEnabled, permission]);

  const handleNewOrder = useCallback((data) => {
    playNotificationSound();
    showWebNotification(data);

    toast.success(`طلب جديد! إجمالي الطلبات: ${data.count}`, {
      position: 'top-center',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
  }, [playNotificationSound, showWebNotification]);

  useOrderNotifications({
    enabled: enabled && (notificationsEnabled || soundEnabled),
    onNewOrder: handleNewOrder
  });

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
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

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');
        toast.success('تم تفعيل الإشعارات بنجاح ✓');

        new Notification('الإشعارات مفعّلة!', {
          body: 'سيتم إشعارك عند وصول طلبات جديدة',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });

        return true;
      } else if (result === 'denied') {
        setNotificationsEnabled(false);
        localStorage.setItem('notificationsEnabled', 'false');
        toast.error('تم رفض الإشعارات. يرجى السماح بها من إعدادات المتصفح');
        return false;
      } else {
        setNotificationsEnabled(false);
        localStorage.setItem('notificationsEnabled', 'false');
        toast.warning('لم يتم منح الإذن للإشعارات');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('حدث خطأ أثناء طلب الإذن');
      return false;
    }
  };

  const toggleNotifications = async () => {
    if (permission === 'granted' && notificationsEnabled) {
      const newState = false;
      setNotificationsEnabled(newState);
      localStorage.setItem('notificationsEnabled', JSON.stringify(newState));
      toast.info('تم إيقاف الإشعارات');
    } else if (permission === 'granted' && !notificationsEnabled) {
      const newState = true;
      setNotificationsEnabled(newState);
      localStorage.setItem('notificationsEnabled', JSON.stringify(newState));
      toast.success('تم تفعيل الإشعارات ✓');
    } else {
      await requestNotificationPermission();
    }
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('soundEnabled', JSON.stringify(newState));

    if (newState) {
      toast.success('تم تفعيل الصوت');
      try {
        playNotificationBeep(1.0, 3);
      } catch (error) {
        console.error('Error testing sound:', error);
      }
    } else {
      toast.info('تم إيقاف الصوت');
    }
  };

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">

      <button
        onClick={toggleSound}
        className={`p-2 rounded-lg transition-colors ${
          soundEnabled
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
        title={soundEnabled ? 'إيقاف الصوت' : 'تفعيل الصوت'}
      >
        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      <button
        onClick={toggleNotifications}
        className={`p-2 rounded-lg transition-colors ${
          notificationsEnabled
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
        title={notificationsEnabled ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
      >
        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
      </button>
    </div>
  );
}
