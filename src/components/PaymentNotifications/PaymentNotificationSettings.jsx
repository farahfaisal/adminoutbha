import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  getUserNotificationPreferences, 
  updateUserNotificationPreferences 
} from '../../lib/paymentNotificationsApi';
import { useAuth } from '../../contexts/AuthContext';

export default function PaymentNotificationSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    enabled: true,
    in_app_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    payment_notifications: true,
    wallet_notifications: true,
    commission_notifications: true,
    withdrawal_notifications: true,
    reminder_notifications: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: 'Asia/Gaza',
    urgent_only: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchPreferences();
    }
  }, [user?.id]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const data = await getUserNotificationPreferences(user.id);
      setPreferences(data);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast.error('فشل في تحميل تفضيلات الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateUserNotificationPreferences(user.id, preferences);
      toast.success('تم حفظ تفضيلات الإشعارات بنجاح');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('فشل في حفظ تفضيلات الإشعارات');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">إعدادات إشعارات الدفع</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
            saving ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="space-y-6">
        {/* الإعدادات العامة */}
        <div className="border-b pb-6">
          <h4 className="font-medium text-gray-800 mb-4">الإعدادات العامة</h4>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span>تفعيل إشعارات الدفع</span>
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) => handlePreferenceChange('enabled', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span>الإشعارات العاجلة فقط</span>
              <input
                type="checkbox"
                checked={preferences.urgent_only}
                onChange={(e) => handlePreferenceChange('urgent_only', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* قنوات الإشعارات */}
        <div className="border-b pb-6">
          <h4 className="font-medium text-gray-800 mb-4">قنوات الإشعارات</h4>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات التطبيق</span>
                <p className="text-sm text-gray-500">إشعارات داخل التطبيق</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.in_app_enabled}
                onChange={(e) => handlePreferenceChange('in_app_enabled', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات البريد الإلكتروني</span>
                <p className="text-sm text-gray-500">إرسال إشعارات عبر البريد الإلكتروني</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_enabled}
                onChange={(e) => handlePreferenceChange('email_enabled', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات الرسائل النصية</span>
                <p className="text-sm text-gray-500">إرسال إشعارات عبر SMS</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.sms_enabled}
                onChange={(e) => handlePreferenceChange('sms_enabled', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>الإشعارات المنبثقة</span>
                <p className="text-sm text-gray-500">إشعارات المتصفح المنبثقة</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.push_enabled}
                onChange={(e) => handlePreferenceChange('push_enabled', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* أنواع الإشعارات */}
        <div className="border-b pb-6">
          <h4 className="font-medium text-gray-800 mb-4">أنواع الإشعارات</h4>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات المدفوعات</span>
                <p className="text-sm text-gray-500">استلام وفشل المدفوعات</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.payment_notifications}
                onChange={(e) => handlePreferenceChange('payment_notifications', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات المحفظة</span>
                <p className="text-sm text-gray-500">شحن المحفظة والرصيد المنخفض</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.wallet_notifications}
                onChange={(e) => handlePreferenceChange('wallet_notifications', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات العمولات</span>
                <p className="text-sm text-gray-500">كسب العمولات من الطلبات</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.commission_notifications}
                onChange={(e) => handlePreferenceChange('commission_notifications', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>إشعارات السحب</span>
                <p className="text-sm text-gray-500">الموافقة أو رفض طلبات السحب</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.withdrawal_notifications}
                onChange={(e) => handlePreferenceChange('withdrawal_notifications', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <div>
                <span>تذكيرات الدفع</span>
                <p className="text-sm text-gray-500">تذكيرات بالفواتير المستحقة</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.reminder_notifications}
                onChange={(e) => handlePreferenceChange('reminder_notifications', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* ساعات الهدوء */}
        <div>
          <h4 className="font-medium text-gray-800 mb-4">ساعات الهدوء</h4>
          <p className="text-sm text-gray-500 mb-4">
            لن يتم إرسال إشعارات غير عاجلة خلال هذه الساعات
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                بداية ساعات الهدوء
              </label>
              <input
                type="time"
                value={preferences.quiet_hours_start || ''}
                onChange={(e) => handlePreferenceChange('quiet_hours_start', e.target.value || null)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نهاية ساعات الهدوء
              </label>
              <input
                type="time"
                value={preferences.quiet_hours_end || ''}
                onChange={(e) => handlePreferenceChange('quiet_hours_end', e.target.value || null)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}