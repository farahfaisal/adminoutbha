import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';

export default function PaymentSettings() {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [commissionSettings, setCommissionSettings] = useState({
    deliveryCommission: 15,
    autoDeductFromDriver: true,
    autoChargeVendor: true
  });

  useEffect(() => {
    fetchPaymentMethods();
    loadCommissionSettings();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods_config')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('فشل في تحميل طرق الدفع');
    }
  };

  const loadCommissionSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .single();
      
      if (error) throw error;
      
      if (data?.settings?.commission) {
        setCommissionSettings(data.settings.commission);
      }
    } catch (error) {
      console.error('Error loading commission settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // حفظ إعدادات العمولة
      const { data: currentSettings, error: fetchError } = await supabase
        .from('app_settings')
        .select('settings')
        .single();
      
      if (fetchError) throw fetchError;
      
      const updatedSettings = {
        ...currentSettings.settings,
        commission: commissionSettings
      };
      
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ settings: updatedSettings })
        .eq('id', currentSettings.id);
      
      if (updateError) throw updateError;
      
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodStatusChange = async (id, enabled) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('payment_methods_config')
        .update({ status: enabled ? 'active' : 'inactive' })
        .eq('id', id);
      
      if (error) throw error;
      
      setPaymentMethods(methods => 
        methods.map(method => 
          method.id === id ? { ...method, status: enabled ? 'active' : 'inactive' } : method
        )
      );
      
      toast.success(`تم ${enabled ? 'تفعيل' : 'تعطيل'} طريقة الدفع بنجاح`);
    } catch (error) {
      console.error('Error updating payment method status:', error);
      toast.error('فشل في تحديث حالة طريقة الدفع');
    } finally {
      setLoading(false);
    }
  };

  const PaymentMethodCard = ({ type, method }) => (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-md p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            type === 'wallet' ? 'bg-purple-100 text-purple-600' : 
            type === 'electronic' ? 'bg-blue-100 text-blue-600' : 
            'bg-green-100 text-green-600'
          }`}>
            {(method.settings?.icon) || (
              type === 'wallet' ? '👛' : 
              type === 'electronic' ? '💳' : 
              '💰'
            )}
          </div>
          <h3 className="text-xl font-bold">{method.name}</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={method.status === 'active'}
            onChange={(e) => handlePaymentMethodStatusChange(method.id, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <p className="text-gray-600">{method.description || 'لا يوجد وصف متاح'}</p>
        </div>

        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-blue-600">📝</span>
            خطوات العمل
          </h4>
          <div className="space-y-2">
            {((method.settings?.steps) || []).map((step, index) => (
              <div key={index} className="bg-white px-4 py-2 rounded-lg shadow-sm">
                {step}
              </div>
            ))}
          </div>
        </div>

        {(method.settings?.note) && (
          <div className={`p-4 rounded-lg ${
            type === 'wallet' ? 'bg-purple-50 text-purple-800' : 
            type === 'electronic' ? 'bg-blue-50 text-blue-800' : 
            'bg-green-50 text-green-800'
          }`}>
            <p>{method.settings?.note}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">⚙️</div>
          <h2 className="text-2xl font-bold">إعدادات طرق الدفع</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <span>💾</span>
          {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 mt-8">
        <h2 className="text-2xl font-bold mb-4">طرق الدفع المتاحة</h2>
        {paymentMethods.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-500">لا توجد طرق دفع متاحة</p>
          </div>
        ) : (
          paymentMethods.map(method => 
            <PaymentMethodCard key={method.id} type={method.type} method={method} />
          )
        )}
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-md p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-full">💰</div>
          <h3 className="text-xl font-bold">إعدادات العمولة والخصومات</h3>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <label className="block text-gray-700 font-semibold mb-2">
              نسبة عمولة البائع (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={commissionSettings.deliveryCommission}
                onChange={(e) => setCommissionSettings({ ...commissionSettings, deliveryCommission: Number(e.target.value) })}
                className="w-32 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                min="0"
                max="100"
              />
              <span className="text-gray-600">%</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-100 space-y-3">
            <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={commissionSettings.autoDeductFromDriver}
                onChange={(e) => setCommissionSettings({ ...commissionSettings, autoDeductFromDriver: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"
              />
              <span>خصم تلقائي من السائق (الدفع المسبق)</span>
            </label>

            <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={commissionSettings.autoChargeVendor}
                onChange={(e) => setCommissionSettings({ ...commissionSettings, autoChargeVendor: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"
              />
              <span>شحن محفظة البائع تلقائيًا</span>
            </label>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>🧪</span>
              مثال توضيحي
            </h4>
            <p className="text-gray-600 mb-4">الطلب: 70 شيكل (60 للمنتج + 10 توصيل)</p>
            <div className="space-y-2">
              <p className="text-blue-600 bg-white px-4 py-2 rounded-lg shadow-sm">
                🔹 عمولة البائع = {commissionSettings.deliveryCommission}% من 60 شيكل = {(60 * commissionSettings.deliveryCommission / 100).toFixed(2)} شيكل
              </p>
              <p className="text-red-600 bg-white px-4 py-2 rounded-lg shadow-sm">
                🔹 عمولة السائق = {commissionSettings.deliveryCommission}% من 10 شيكل = {(10 * commissionSettings.deliveryCommission / 100).toFixed(2)} شيكل
              </p>
              <p className="text-green-600 bg-white px-4 py-2 rounded-lg shadow-sm">
                🔹 إجمالي العمولة للنظام = {(60 * commissionSettings.deliveryCommission / 100 + 10 * commissionSettings.deliveryCommission / 100).toFixed(2)} شيكل
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}