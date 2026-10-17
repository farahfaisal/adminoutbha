import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useVendor } from '../contexts/VendorContext';
import { Store, Mail, Lock, LogIn } from 'lucide-react';

export default function VendorLogin() {
  const navigate = useNavigate();
  const { login } = useVendor();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      setLoading(true);
      await login(formData.email, formData.password);
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/vendor/products');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'فشل تسجيل الدخول. الرجاء التحقق من البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <div className="flex justify-center mb-4">
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-4">
                <Store className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">
              بوابة البائعين
            </h1>
            <p className="text-blue-100 text-center">
              قم بتسجيل الدخول لإدارة منتجاتك
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full pr-10 border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="vendor@example.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pr-10 border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>جاري تسجيل الدخول...</span>
                </div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                العودة إلى الصفحة الرئيسية
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            لا تملك حساب بائع؟{' '}
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              تواصل مع الإدارة
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
