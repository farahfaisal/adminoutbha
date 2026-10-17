import React, { useState, Suspense } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';

// Properly use React.lazy by assigning it to a variable
const UserSettings = React.lazy(() => import('./UserSettings'));

export default function Settings() {
  const { settings: globalSettings, saveSettings } = useSettings();
  const [settings, setSettings] = useState({
    store: {
      ...globalSettings.store
    },
    orders: {
      ...globalSettings.orders
    },
    social: {
      ...globalSettings.social
    },
    notifications: {
      ...globalSettings.notifications
    },
    login: {
      ...globalSettings.login
    }
  });

  const [activeTab, setActiveTab] = useState('general');
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingSessions, setClearingSessions] = useState(false);

  const handleSave = async () => {
    try {
      // Save all settings
      const success = await saveSettings(settings);
      if (success) {
        // Update document title with new store name
        document.title = `لوحة تحكم ${settings.store.name}`;
        toast.success('تم حفظ الإعدادات بنجاح');
      }
    } catch (error) {
      toast.error('فشل في حفظ الإعدادات');
    }
  };

  const processExistingPendingOrders = async () => {
    try {
      const targetStatus = 'waiting-for-driver';

      // Get all pending orders (regular orders)
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      // Get all pending captain orders
      const { data: pendingCaptainOrders, error: captainError } = await supabase
        .from('captain_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      // Get all pending parcel orders
      const { data: pendingParcelOrders, error: parcelError } = await supabase
        .from('parcel_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (ordersError) console.error('Error fetching orders:', ordersError);
      if (captainError) console.error('Error fetching captain orders:', captainError);
      if (parcelError) console.error('Error fetching parcel orders:', parcelError);

      const totalToProcess =
        (pendingOrders?.length || 0) +
        (pendingCaptainOrders?.length || 0) +
        (pendingParcelOrders?.length || 0);

      if (totalToProcess === 0) {
        toast.info('لا توجد طلبات تحتاج للمعالجة');
        return;
      }

      toast.info(`جاري معالجة ${totalToProcess} طلب...`);

      let processedCount = 0;

      // Process regular orders
      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          // تحديث حالة الطلب
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: targetStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (!updateError) {
            // إضافة سجل في order_status_history
            await supabase
              .from('order_status_history')
              .insert({
                order_id: order.id,
                status: targetStatus,
                note: 'تم قبول الطلب تلقائياً ونقله إلى قائمة انتظار السائقين',
                created_at: new Date().toISOString()
              });

            // إضافة إلى driver_waiting_list
            await supabase
              .from('driver_waiting_list')
              .insert({
                order_id: order.id,
                vendor_id: order.vendor_id,
                status: 'pending',
                created_at: new Date().toISOString(),
                geocoded_latitude: order.geocoded_latitude,
                geocoded_longitude: order.geocoded_longitude,
                total: order.total
              })
              .onConflict('order_id')
              .ignore();

            processedCount++;
          }
        }
      }

      // Process captain orders
      if (pendingCaptainOrders && pendingCaptainOrders.length > 0) {
        for (const order of pendingCaptainOrders) {
          const newStatusHistory = [
            ...(order.status_history || []),
            {
              status: targetStatus,
              timestamp: new Date().toISOString(),
              note: 'تم قبول الطلب تلقائياً ونقله إلى قائمة انتظار السائقين'
            }
          ];

          const { error } = await supabase
            .from('captain_orders')
            .update({
              status: targetStatus,
              status_history: newStatusHistory,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (!error) processedCount++;
        }
      }

      // Process parcel orders
      if (pendingParcelOrders && pendingParcelOrders.length > 0) {
        for (const order of pendingParcelOrders) {
          const newStatusHistory = [
            ...(order.status_history || []),
            {
              status: targetStatus,
              timestamp: new Date().toISOString(),
              note: 'تم قبول الطلب تلقائياً ونقله إلى قائمة انتظار السائقين'
            }
          ];

          const { error } = await supabase
            .from('parcel_orders')
            .update({
              status: targetStatus,
              status_history: newStatusHistory,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (!error) processedCount++;
        }
      }

      if (processedCount > 0) {
        toast.success(`تم معالجة ${processedCount} طلب بنجاح وإضافتهم إلى قائمة انتظار السائقين`);
      } else {
        toast.error('فشل في معالجة الطلبات');
      }
    } catch (error) {
      console.error('Error processing existing orders:', error);
      toast.error('حدث خطأ أثناء معالجة الطلبات');
    }
  };

  const handleAutoProcessingChange = async (enabled) => {
    const newSettings = {
      ...settings,
      orders: {
        ...settings.orders,
        autoProcessing: enabled
      }
    };

    setSettings(newSettings);

    // Save immediately
    const success = await saveSettings(newSettings);
    if (success) {
      if (enabled) {
        toast.success('تم تفعيل المعالجة التلقائية للطلبات الجديدة فقط');
      } else {
        toast.info('تم إيقاف المعالجة التلقائية للطلبات');
      }
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Store Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">معلومات المتجر</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المتجر
            </label>
            <input
              type="text"
              value={settings.store.name}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, name: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={settings.store.email}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, email: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم الهاتف
            </label>
            <input
              type="tel"
              value={settings.store.phone}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, phone: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العملة
            </label>
            <select
              value={settings.store.currency}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, currency: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="ILS">₪ شيكل</option>
              <option value="USD">$ دولار</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العنوان
            </label>
            <input
              type="text"
              value={settings.store.address}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, address: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              وصف المتجر
            </label>
            <textarea
              value={settings.store.description}
              onChange={(e) => setSettings({
                ...settings,
                store: { ...settings.store, description: e.target.value }
              })}
              rows="3"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Social Media Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">روابط التواصل الاجتماعي</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              فيسبوك
            </label>
            <input
              type="url"
              value={settings.social.facebook}
              onChange={(e) => setSettings({
                ...settings,
                social: { ...settings.social, facebook: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://facebook.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              تويتر
            </label>
            <input
              type="url"
              value={settings.social.twitter}
              onChange={(e) => setSettings({
                ...settings,
                social: { ...settings.social, twitter: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://twitter.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              انستغرام
            </label>
            <input
              type="url"
              value={settings.social.instagram}
              onChange={(e) => setSettings({
                ...settings,
                social: { ...settings.social, instagram: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://instagram.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              واتساب
            </label>
            <input
              type="tel"
              value={settings.social.whatsapp}
              onChange={(e) => setSettings({
                ...settings,
                social: { ...settings.social, whatsapp: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="رقم الواتساب"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">إعدادات الإشعارات</h3>
      <div className="space-y-4">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={settings.notifications.email}
            onChange={(e) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, email: e.target.checked }
            })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span>إشعارات البريد الإلكتروني</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={settings.notifications.sms}
            onChange={(e) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, sms: e.target.checked }
            })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span>إشعارات الرسائل النصية</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={settings.notifications.push}
            onChange={(e) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, push: e.target.checked }
            })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span>إشعارات التطبيق</span>
        </label>
      </div>
    </div>
  );

  const renderOrderSettings = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">إعدادات معالجة الطلبات</h3>
        {settings.orders?.autoProcessing && (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            المعالجة التلقائية مفعلة
          </span>
        )}
      </div>
      <div className="space-y-6">
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h4 className="font-medium text-gray-800">المعالجة التلقائية للطلبات</h4>
              <p className="text-sm text-gray-600 mt-1">
                عند التفعيل، سيتم قبول جميع الطلبات الجديدة تلقائياً وإرسالها إلى قائمة انتظار السائقين
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mr-4">
              <input
                type="checkbox"
                checked={settings.orders?.autoProcessing || false}
                onChange={(e) => handleAutoProcessingChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {settings.orders?.autoProcessing && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h5 className="font-medium text-blue-800 mb-2">خطوات المعالجة التلقائية:</h5>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                <li>استلام الطلب الجديد</li>
                <li>قبول الطلب تلقائياً</li>
                <li>إضافة الطلب مباشرة إلى قائمة انتظار السائقين</li>
                <li>إرسال إشعار للسائقين المتاحين</li>
              </ol>
            </div>
          )}
        </div>
        
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">إعدادات إضافية</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                وقت التحضير الافتراضي (دقيقة)
              </label>
              <input
                type="number"
                value={settings.orders?.defaultPreparationTime || 15}
                onChange={(e) => setSettings({
                  ...settings,
                  orders: {
                    ...settings.orders,
                    defaultPreparationTime: parseInt(e.target.value) || 15
                  }
                })}
                className="w-32 border rounded-md px-3 py-2"
                min="5"
                max="120"
              />
              <p className="text-xs text-gray-500 mt-1">
                سيتم استخدام هذا الوقت للطلبات التي لا تحتوي على وقت تحضير محدد
              </p>
            </div>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.orders?.notifyDrivers || true}
                onChange={(e) => setSettings({
                  ...settings,
                  orders: { 
                    ...settings.orders, 
                    notifyDrivers: e.target.checked 
                  }
                })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>إرسال إشعارات للسائقين عند إضافة طلب جديد لقائمة الانتظار</span>
            </label>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.orders?.autoUpdateStatus || true}
                onChange={(e) => setSettings({
                  ...settings,
                  orders: { 
                    ...settings.orders, 
                    autoUpdateStatus: e.target.checked 
                  }
                })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>تحديث حالة الطلب تلقائياً عند المعالجة</span>
            </label>
          </div>
        </div>
        
        {settings.orders?.autoProcessing && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-start">
                <div className="text-yellow-600 text-xl mr-3">⚠️</div>
                <div>
                  <h5 className="font-medium text-yellow-800 mb-2">تنبيه هام</h5>
                  <p className="text-yellow-700 text-sm">
                    عند تفعيل المعالجة التلقائية، سيتم قبول جميع الطلبات الجديدة تلقائياً دون مراجعة يدوية.
                    تأكد من أن هذا هو السلوك المطلوب قبل التفعيل.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-blue-800 mb-1">معالجة الطلبات القديمة</h5>
                  <p className="text-blue-700 text-sm">
                    نقل جميع الطلبات (المعلقة وقيد التحضير) إلى قائمة انتظار السائقين
                  </p>
                </div>
                <button
                  onClick={processExistingPendingOrders}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  معالجة الآن
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
  const renderLoginSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">إعدادات صفحة تسجيل الدخول</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رابط شعار صفحة تسجيل الدخول
            </label>
            <input
              type="url"
              value={settings.login.logo}
              onChange={(e) => setSettings({
                ...settings,
                login: { ...settings.login, logo: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رابط خلفية صفحة تسجيل الدخول
            </label>
            <input
              type="url"
              value={settings.login.background}
              onChange={(e) => setSettings({
                ...settings,
                login: { ...settings.login, background: e.target.value }
              })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://example.com/background.jpg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">معاينة صفحة تسجيل الدخول</h3>
        <div className="border rounded-lg overflow-hidden">
          <div className="relative" style={{
            background: settings.login.background 
              ? `url(${settings.login.background}) center/cover no-repeat`
              : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: '2rem',
            minHeight: '400px'
          }}>
            <div className="relative z-10 flex items-center justify-center">
              <div className="bg-white bg-opacity-95 backdrop-blur-sm p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-200">
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    {settings.login.logo ? (
                      <img 
                        src={settings.login.logo} 
                        alt="Logo" 
                        className="h-20 w-20 rounded-lg shadow-lg"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-lg shadow-lg bg-blue-600 text-white flex items-center justify-center text-3xl">
                        🛒
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">تسجيل الدخول</h2>
               
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-yellow-500 focus:border-yellow-500 shadow-sm"
                        placeholder="أدخل البريد الإلكتروني"
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-yellow-500 focus:border-yellow-500 shadow-sm"
                        placeholder="أدخل كلمة المرور"
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div>
                    <button
                      className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 py-2 rounded-md hover:from-yellow-600 hover:to-yellow-700 transition-colors shadow-md font-bold opacity-70 cursor-not-allowed"
                      disabled
                    >
                      تسجيل الدخول
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Add user settings renderer - fixed to use Suspense properly
  const renderUserSettings = () => (
    <div id="userSettings">
      <Suspense fallback={<div>جاري التحميل...</div>}>
        <UserSettings />
      </Suspense>
    </div>
  );

  const clearAllSessions = async () => {
    if (!window.confirm('هل أنت متأكد من تسجيل خروج جميع المستخدمين من جميع الأجهزة؟')) {
      return;
    }

    try {
      setClearingSessions(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('يجب تسجيل الدخول أولاً');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clear-all-sessions`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في مسح الجلسات');
      }

      toast.success('تم تسجيل خروج جميع المستخدمين بنجاح. سيتم إعادة تحميل الصفحة...');

      setTimeout(() => {
        window.location.reload(true);
      }, 2000);

    } catch (error) {
      console.error('Error clearing sessions:', error);
      toast.error(error.message || 'حدث خطأ أثناء مسح الجلسات');
    } finally {
      setClearingSessions(false);
    }
  };

  const clearAllCache = async () => {
    if (!window.confirm('هل أنت متأكد من مسح ذاكرة التخزين المؤقت لهذا الجهاز؟ سيتم حذف جميع البيانات المحفوظة محلياً.')) {
      return;
    }

    try {
      setClearingCache(true);

      // مسح جميع بيانات localStorage
      localStorage.clear();

      // مسح جميع بيانات sessionStorage
      sessionStorage.clear();

      // مسح جميع ملفات تعريف الارتباط (cookies)
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      }

      // مسح Cache API إذا كان متاحاً
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // مسح IndexedDB إذا كان متاحاً
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }

      toast.success('تم مسح ذاكرة التخزين المؤقت بنجاح. سيتم إعادة تحميل الصفحة...');

      // إعادة تحميل الصفحة بعد ثانيتين
      setTimeout(() => {
        window.location.reload(true);
      }, 2000);

    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('حدث خطأ أثناء مسح ذاكرة التخزين المؤقت');
    } finally {
      setClearingCache(false);
    }
  };

  const renderCacheSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">تسجيل خروج جميع المستخدمين</h3>
        <p className="text-gray-600 mb-6">
          يمكنك تسجيل خروج جميع المستخدمين من جميع الأجهزة. هذا سيؤدي إلى:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>إنهاء جميع الجلسات النشطة للمستخدمين</li>
          <li>إجبار جميع المستخدمين على تسجيل الدخول مرة أخرى</li>
          <li>تطبيق على جميع الأجهزة (هواتف، أجهزة كمبيوتر، إلخ)</li>
        </ul>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 ml-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-red-800 mb-1">تحذير</h4>
              <p className="text-sm text-red-700">
                هذا الإجراء سيؤثر على جميع المستخدمين (عملاء، سائقين، بائعين، مدراء). استخدمه فقط عند الضرورة.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={clearAllSessions}
          disabled={clearingSessions}
          className={`
            px-6 py-3 rounded-lg font-semibold transition-colors
            ${clearingSessions
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700'
            }
            text-white
          `}
        >
          {clearingSessions ? 'جاري تسجيل الخروج...' : 'تسجيل خروج جميع المستخدمين'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">مسح ذاكرة التخزين المؤقت (هذا الجهاز فقط)</h3>
        <p className="text-gray-600 mb-6">
          يمكنك مسح ذاكرة التخزين المؤقت لهذا الجهاز فقط. هذا سيؤدي إلى:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>حذف جميع البيانات المحفوظة محلياً</li>
          <li>حذف جميع ملفات تعريف الارتباط</li>
          <li>مسح جميع ذاكرات التخزين المؤقت</li>
          <li>إعادة تحميل الصفحة تلقائياً</li>
        </ul>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 ml-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-yellow-800 mb-1">ملاحظة</h4>
              <p className="text-sm text-yellow-700">
                هذا الإجراء سيؤثر على هذا الجهاز فقط ولن يؤثر على الأجهزة الأخرى.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={clearAllCache}
          disabled={clearingCache}
          className={`
            px-6 py-3 rounded-lg font-semibold transition-colors
            ${clearingCache
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700'
            }
            text-white
          `}
        >
          {clearingCache ? 'جاري المسح...' : 'مسح ذاكرة التخزين المؤقت'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">معلومات التخزين (هذا الجهاز)</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">عدد مفاتيح localStorage:</span>
            <span className="font-semibold">{localStorage.length}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">عدد مفاتيح sessionStorage:</span>
            <span className="font-semibold">{sessionStorage.length}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">ملفات تعريف الارتباط:</span>
            <span className="font-semibold">{document.cookie.split(';').filter(c => c.trim()).length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">الإعدادات</h2>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          حفظ التغييرات
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex gap-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              إعدادات عامة
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              إعدادات الطلبات
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              إعدادات الإشعارات
            </button>
            <button
              onClick={() => setActiveTab('login')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'login'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              إعدادات تسجيل الدخول
            </button>
            <button
              onClick={() => setActiveTab('user')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'user'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              إعدادات المستخدم
            </button>
            <button
              onClick={() => setActiveTab('cache')}
              className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'cache'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ذاكرة التخزين المؤقت
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'orders' && renderOrderSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'login' && renderLoginSettings()}
          {activeTab === 'user' && renderUserSettings()}
          {activeTab === 'cache' && renderCacheSettings()}
        </div>
      </div>
    </div>
  );
}