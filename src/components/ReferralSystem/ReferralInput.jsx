import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';

export default function ReferralInput({ onSuccess }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('الرجاء إدخال كود الإحالة');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('يجب تسجيل الدخول لاستخدام كود الإحالة');
        return;
      }
      
      // Process referral
      const { data, error: referralError } = await supabase.rpc(
        'process_referral',
        { 
          p_referral_code: code,
          p_referred_id: user.id
        }
      );
      
      if (referralError) throw referralError;
      
      if (!data.success) {
        setError(data.message);
        return;
      }
      
      toast.success('تم استخدام كود الإحالة بنجاح');
      setCode('');
      
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      setError('حدث خطأ أثناء معالجة كود الإحالة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">استخدم كود إحالة</h3>
      
      {error && (
        <div className="bg-red-50 text-red-800 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            كود الإحالة
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="أدخل كود الإحالة هنا"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors ${
            loading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'جاري المعالجة...' : 'استخدم الكود'}
        </button>
      </form>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>استخدم كود الإحالة للحصول على 100 نقطة مكافأة</p>
      </div>
    </div>
  );
}