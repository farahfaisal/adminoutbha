import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Bell, Volume2, VolumeX, Check, X } from 'lucide-react';
import { testNotificationSound } from '../../utils/notificationSound';

export default function NotificationSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('يجب تسجيل الدخول أولاً');
        return;
      }

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        const defaultSettings = {
          user_id: user.id,
          sound_enabled: true,
          browser_notifications_enabled: true,
          continuous_sound_enabled: true,
          auto_notifications_enabled: true
        };

        const { data: newSettings, error: createError } = await supabase
          .from('notification_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (createError) throw createError;

        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('فشل في تحميل إعدادات الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (field, value) => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('يجب تسجيل الدخول أولاً');
        return;
      }

      const { error } = await supabase
        .from('notification_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings({ ...settings, [field]: value });
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success('تم تفعيل إشعارات المتصفح');
        new Notification('تم التفعيل', {
          body: 'ستتلقى الآن إشعارات عند وصول طلبات جديدة',
          icon: '/favicon.ico'
        });
      } else if (permission === 'denied') {
        toast.error('تم رفض إذن الإشعارات');
      }
    }
  };

  const testSound = () => {
    testNotificationSound();
    toast.info('تم تشغيل الصوت التجريبي');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">إعدادات الإشعارات</h1>
              <p className="text-blue-100 text-sm">تحكم في الإشعارات الصوتية والمنبثقة</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  حول نظام الإشعارات
                </h3>
                <p className="text-sm text-blue-800">
                  سيتم إرسال إشعار فوري عند وصول أي طلب جديد في حالة "معلق" (Pending).
                  يمكنك التحكم في الصوت والإشعارات المنبثقة من الإعدادات أدناه.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                {settings?.sound_enabled ? (
                  <Volume2 className="w-6 h-6 text-green-600" />
                ) : (
                  <VolumeX className="w-6 h-6 text-gray-400" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">الإشعارات الصوتية</h3>
                  <p className="text-sm text-gray-600">
                    تشغيل صوت تنبيه عند وصول طلب جديد
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {settings?.sound_enabled && (
                  <button
                    onClick={testSound}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    تجربة الصوت
                  </button>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings?.sound_enabled || false}
                    onChange={(e) => updateSetting('sound_enabled', e.target.checked)}
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className={`w-6 h-6 ${settings?.browser_notifications_enabled ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <h3 className="font-semibold text-gray-900">إشعارات المتصفح</h3>
                  <p className="text-sm text-gray-600">
                    عرض إشعارات منبثقة في المتصفح
                  </p>
                  {notificationPermission === 'denied' && (
                    <p className="text-xs text-red-600 mt-1">
                      تم رفض الإذن - يرجى تفعيله من إعدادات المتصفح
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {notificationPermission === 'default' && (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    طلب الإذن
                  </button>
                )}
                {notificationPermission === 'granted' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    مفعّل
                  </span>
                )}
                {notificationPermission === 'denied' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <X className="w-4 h-4" />
                    مرفوض
                  </span>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings?.browser_notifications_enabled || false}
                    onChange={(e) => updateSetting('browser_notifications_enabled', e.target.checked)}
                    disabled={saving || notificationPermission === 'denied'}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Volume2 className={`w-6 h-6 ${settings?.continuous_sound_enabled ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <h3 className="font-semibold text-gray-900">الصوت المستمر</h3>
                  <p className="text-sm text-gray-600">
                    تكرار صوت التنبيه للطلبات المعلقة
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings?.continuous_sound_enabled || false}
                  onChange={(e) => updateSetting('continuous_sound_enabled', e.target.checked)}
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className={`w-6 h-6 ${settings?.auto_notifications_enabled ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <h3 className="font-semibold text-gray-900">الإشعارات التلقائية</h3>
                  <p className="text-sm text-gray-600">
                    إشعارات تلقائية حتى مع تفعيل المعالجة التلقائية
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings?.auto_notifications_enabled || false}
                  onChange={(e) => updateSetting('auto_notifications_enabled', e.target.checked)}
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">
                  نصائح مهمة
                </h3>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>تأكد من السماح بالإشعارات في إعدادات المتصفح</li>
                  <li>الصوت لن يعمل حتى تتفاعل مع الصفحة أولاً</li>
                  <li>يمكنك تجربة الصوت من خلال زر "تجربة الصوت"</li>
                  <li>الإشعارات ستظهر حتى عند تصغير المتصفح</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
