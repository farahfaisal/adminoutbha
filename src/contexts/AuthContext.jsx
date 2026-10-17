import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';
import { verifyAdminPassword } from '../lib/adminUsersApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);

        const savedUserData = localStorage.getItem('userData');
        if (savedUserData) {
          try {
            const parsedUser = JSON.parse(savedUserData);
            if (parsedUser && typeof parsedUser === 'object') {
              setUser(parsedUser);
            } else {
              localStorage.removeItem('userData');
            }
          } catch (e) {
            console.error('Error parsing user data:', e);
            localStorage.removeItem('userData');
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setLoading(false);
          return;
        }

        if (!session && savedUserData) {
          try {
            const parsedUser = JSON.parse(savedUserData);
            if (parsedUser && !parsedUser.isSuperAdmin) {
              try {
                await supabase.auth.signInAnonymously();
                await supabase.rpc('ensure_admin_access');
              } catch (e) {
                console.error('Error restoring session:', e);
              }
            }
          } catch (e) {
            console.error('Error parsing saved user data:', e);
          }
        }
      } catch (error) {
        console.error('Error checking user:', error);
        try {
          localStorage.removeItem('userData');
        } catch (e) {
          console.error('Error clearing userData:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        try {
          localStorage.removeItem('userData');
        } catch (e) {
          console.error('Error removing userData:', e);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (username, password) => {
    try {
      setLoading(true);

      // أولاً: محاولة تسجيل الدخول كـ super admin عبر Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      });

      if (!authError && authData?.user) {
        // التحقق من أن المستخدم هو super admin
        const { data: superAdminData } = await supabase
          .from('super_admins')
          .select('*')
          .eq('user_id', authData.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (superAdminData) {
          // تحديث آخر دخول
          await supabase
            .from('super_admins')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', authData.user.id);

          const userData = {
            id: authData.user.id,
            name: authData.user.email.split('@')[0] || 'مدير النظام',
            email: superAdminData.email,
            role: 'admin',
            username: superAdminData.email,
            isSuperAdmin: true
          };

          setUser(userData);
          localStorage.setItem('userData', JSON.stringify(userData));

          if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem('rememberedEmail', username);
          }

          toast.success('تم تسجيل الدخول بنجاح');
          return userData;
        }
      }

      // ثانياً: محاولة تسجيل الدخول كـ admin عادي
      const verifyResult = await verifyAdminPassword(username, password);

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'بيانات الدخول غير صحيحة');
      }

      const { data: { session } } = await supabase.auth.getSession();

      let anonData;
      if (!session) {
        const { data, error: anonError } = await supabase.auth.signInAnonymously();

        if (anonError) {
          console.error('Anonymous auth error:', anonError);
        }

        anonData = data;

        if (data?.user) {
          try {
            await supabase.rpc('ensure_admin_access');
          } catch (e) {
            console.error('Error ensuring admin access:', e);
          }
        }
      } else {
        anonData = { user: session.user };
      }

      const userData = {
        id: anonData?.user?.id || verifyResult.user_id,
        name: verifyResult.full_name || 'مدير النظام',
        email: verifyResult.email || 'admin@example.com',
        role: 'admin',
        username: verifyResult.username,
        isSuperAdmin: false
      };

      setUser(userData);
      localStorage.setItem('userData', JSON.stringify(userData));

      if (localStorage.getItem('rememberMe') === 'true') {
        localStorage.setItem('rememberedEmail', username);
      }

      if (verifyResult.warning) {
        toast.warning(verifyResult.warning);
      } else {
        toast.success('تم تسجيل الدخول بنجاح');
      }

      return userData;
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'فشل تسجيل الدخول');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      await supabase.auth.signOut();

      setUser(null);

      try {
        localStorage.removeItem('userData');

        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }

      toast.info('تم تسجيل الخروج بنجاح');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('فشل تسجيل الخروج');
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = () => {
    // Check if user is set in state
    if (user) return true;

    try {
      // If not in state, check localStorage as fallback
      const savedUserData = localStorage.getItem('userData');
      if (savedUserData) {
        try {
          const parsedUser = JSON.parse(savedUserData);
          return true;
        } catch (e) {
          console.error('Error parsing user data:', e);
          localStorage.removeItem('userData');
          return false;
        }
      }
    } catch (e) {
      console.error('Error checking authentication:', e);
    }

    return false;
  };

  // Function to get current user
  const getCurrentUser = () => {
    if (user) return user;

    try {
      const savedUserData = localStorage.getItem('userData');
      if (savedUserData) {
        try {
          return JSON.parse(savedUserData);
        } catch (e) {
          console.error('Error parsing user data:', e);
          return null;
        }
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }
    
    return null;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading, 
      isAuthenticated,
      getCurrentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};