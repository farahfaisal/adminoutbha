import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentVendor, vendorLogin, vendorLogout } from '../lib/vendorAuth';
import { supabase } from '../lib/supabase';

const VendorContext = createContext();

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('useVendor must be used within VendorProvider');
  }
  return context;
};

export const VendorProvider = ({ children }) => {
  const [vendor, setVendor] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVendor();

    // الاستماع لتغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          await checkVendor();
        } else if (event === 'SIGNED_OUT') {
          setVendor(null);
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkVendor = async () => {
    try {
      setLoading(true);
      const currentVendor = await getCurrentVendor();
      if (currentVendor) {
        setVendor(currentVendor.vendor);
        setUser(currentVendor.user);
      } else {
        setVendor(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking vendor:', error);
      setVendor(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const result = await vendorLogin(email, password);
    setVendor(result.vendor);
    setUser(result.user);
    return result;
  };

  const logout = async () => {
    await vendorLogout();
    setVendor(null);
    setUser(null);
  };

  const value = {
    vendor,
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!vendor,
    checkVendor
  };

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};
