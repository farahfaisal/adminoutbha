import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { MapPin } from 'lucide-react';

export default function ServiceAreaManagerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: managerData, error: managerError } = await supabase
        .from('service_area_managers')
        .select('id, user_id, name, email, status')
        .eq('email', email)
        .eq('status', 'active')
        .single();

      if (managerError || !managerData) {
        toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      if (managerData.user_id) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
          setLoading(false);
          return;
        }

        localStorage.setItem('userData', JSON.stringify({
          role: 'service_area_manager',
          manager_id: managerData.id,
          name: managerData.name,
          email: managerData.email
        }));

        toast.success('تم تسجيل الدخول بنجاح');
        navigate('/admin-dashboard');
      } else {
        toast.error('حساب غير صالح');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">مسؤول منطقة الخدمة</h1>
            <p className="text-gray-600 mt-2">تسجيل الدخول إلى لوحة التحكم</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              العودة إلى صفحة تسجيل الدخول الرئيسية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
