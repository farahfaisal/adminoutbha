import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  store: {
    name: 'اطلبها',
    description: 'نظام متكامل لإدارة المتجر',
    email: 'info@example.com',
    phone: '0599123456',
    address: 'غزة، فلسطين',
    logo: '/logo.svg',
    currency: 'ILS',
    language: 'ar'
  },
  orders: {
    autoProcessing: false,
    defaultPreparationTime: 15,
    notifyDrivers: true,
    autoUpdateStatus: true
  },
  social: {
    facebook: '',
    twitter: '',
    instagram: '',
    whatsapp: ''
  },
  notifications: {
    email: true,
    sms: false,
    push: true
  },
  login: {
    logo: '/logo.svg',
    background: '/login-bg.jpg'
  }
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Fetch settings from database on initial load
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);

        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            setSettings(parsed);
          } catch (e) {
            console.error('Error parsing saved settings:', e);
            localStorage.removeItem('appSettings');
            setSettings(DEFAULT_SETTINGS);
          }
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      } else if (data && data.settings) {
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings
        };
        setSettings(mergedSettings);
        try {
          localStorage.setItem('appSettings', JSON.stringify(mergedSettings));
        } catch (e) {
          console.error('Error saving settings to localStorage:', e);
        }
      } else {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            setSettings(parsed);
          } catch (e) {
            console.error('Error parsing saved settings:', e);
            localStorage.removeItem('appSettings');
            setSettings(DEFAULT_SETTINGS);
          }
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(parsed);
        } catch (e) {
          console.error('Error parsing saved settings:', e);
          localStorage.removeItem('appSettings');
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      setLoading(true);

      try {
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
      } catch (e) {
        console.error('Error saving settings to localStorage:', e);
      }

      const { data: existingData } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingData) {
        const { error } = await supabase
          .from('app_settings')
          .update({ settings: newSettings, updated_at: new Date().toISOString() })
          .eq('id', existingData.id);

        if (error) {
          console.error('Error updating settings:', error);
        }
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert([{ settings: newSettings }]);

        if (error) {
          console.error('Error inserting settings:', error);
        }
      }

      setSettings(newSettings);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('فشل في حفظ الإعدادات');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateStoreName = async (name) => {
    try {
      const newSettings = {
        ...settings,
        store: {
          ...settings.store,
          name
        }
      };
      
      const success = await saveSettings(newSettings);
      return success;
    } catch (error) {
      console.error('Error updating store name:', error);
      return false;
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      loading, 
      saveSettings,
      updateStoreName
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

