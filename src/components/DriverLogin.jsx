import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginDriver, isDriverLoggedIn } from '../lib/driverAuth';

export default function DriverLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const navigate = useNavigate();

  // Check for saved credentials on component mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedDriverUsername');
    const savedRememberMe = localStorage.getItem('rememberDriverMe') === 'true';
    
    if (savedUsername && savedRememberMe) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // If already logged in, redirect to driver dashboard
  if (isDriverLoggedIn()) {
    return <Navigate to="/driver-dashboard" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Store rememberMe preference
      if (rememberMe) {
        localStorage.setItem('rememberDriverMe', 'true');
        localStorage.setItem('rememberedDriverUsername', username);
      } else {
        localStorage.removeItem('rememberDriverMe');
        localStorage.removeItem('rememberedDriverUsername');
      }

      // Login with driver credentials
      await loginDriver(username, password);

      // Redirect to driver dashboard
      navigate('/driver-dashboard');
      toast.success('تم تسجيل الدخول بنجاح');

    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.message || 'فشل في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: `url('/driver-login-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}
    >
      {/* Overlay with blue accents */}
      <div 
        className="absolute inset-0 z-0" 
        style={{
          background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.1) 0%, rgba(15, 23, 42, 0.9) 70%)',
          boxShadow: 'inset 0 0 100px rgba(59, 130, 246, 0.2)'
        }}
      ></div>
      
      {/* Blue decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400 rounded-full filter blur-3xl opacity-10 -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400 rounded-full filter blur-3xl opacity-10 -ml-32 -mb-32"></div>
      
      <div className="relative z-10 bg-white bg-opacity-95 backdrop-blur-sm p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-lg shadow-lg bg-blue-600 text-white flex items-center justify-center text-3xl">
              🚚
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">تسجيل دخول السائق</h2>
          <p className="text-gray-600 mt-2">مرحباً بك في نظام توصيل الطلبات</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-6 border-r-4 border-red-500">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="أدخل اسم المستخدم"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="أدخل كلمة المرور"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="mr-2 block text-sm text-gray-700">
                تذكرني
              </label>
            </div>
            
            <div className="text-sm">
              <a href="#" className="text-blue-600 hover:text-blue-500 font-medium">
                نسيت كلمة المرور؟
              </a>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-md hover:from-blue-600 hover:to-blue-700 transition-colors shadow-md font-bold ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}