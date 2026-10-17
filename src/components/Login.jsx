import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, isAuthenticated, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/admin-dashboard';

  // Check for saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedEmail && savedRememberMe) {
      setUsername(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Update document title when settings change
  useEffect(() => {
    document.title = `تسجيل الدخول - ${settings.store.name}`;
  }, [settings.store.name]);

  // If already logged in, redirect to appropriate dashboard
  if (isAuthenticated()) {
    // Check if user exists and has a role before accessing user.role
    const currentUser = user || JSON.parse(localStorage.getItem('userData') || '{}');
    if (currentUser && currentUser.role) {
      if (currentUser.role === 'admin') {
        return <Navigate to={from} />;
      }
    } else {
      // If user exists but role is missing, try to refresh user data
      console.warn('User exists but role is missing, trying to refresh user data');
      // Don't logout here, just continue to login page
    }
    // Default redirect if user exists but role is unknown
    return <Navigate to={from} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Store rememberMe preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('rememberedEmail', username);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberedEmail');
      }

      // Login with credentials
      await login(username.trim(), password);

      // Redirect based on role
      navigate(from);

    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.message || 'فشل في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  // Get login background from settings or use default
  const loginBackground = settings.login?.background || '/login-bg.jpg';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        minHeight: '-webkit-fill-available'
      }}
    >
      {/* Overlay with yellow accents */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(circle at top right, rgba(250, 204, 21, 0.1) 0%, rgba(15, 23, 42, 0.9) 70%)',
          boxShadow: 'inset 0 0 100px rgba(250, 204, 21, 0.2)'
        }}
      ></div>

      {/* Yellow decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-3xl opacity-10 -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-3xl opacity-10 -ml-32 -mb-32"></div>

      <div className="relative z-10 bg-white bg-opacity-95 backdrop-blur-sm p-6 md:p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">تسجيل الدخول</h2>
          <p className="text-gray-600 mt-2">مرحباً بك في نظام {settings.store.name}</p>
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
                placeholder="أدخل اسم المستخدم"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
                placeholder="أدخل كلمة المرور"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
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
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="mr-2 block text-sm text-gray-700">
                تذكرني
              </label>
            </div>
            
            <div className="text-sm">
              <a href="#" className="text-red-600 hover:text-red-500 font-medium">
                نسيت كلمة المرور؟
              </a>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-2 rounded-md hover:from-red-600 hover:to-red-700 transition-colors shadow-md font-bold ${
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