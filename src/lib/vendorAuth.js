import { supabase } from './supabase';

/**
 * تسجيل دخول البائع
 */
export const vendorLogin = async (email, password) => {
  try {
    // تسجيل الدخول عبر Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;

    // التحقق من أن المستخدم هو بائع
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (vendorError) throw vendorError;

    if (!vendor) {
      // إذا لم يكن المستخدم بائعاً، نقوم بتسجيل الخروج
      await supabase.auth.signOut();
      throw new Error('هذا الحساب ليس حساب بائع');
    }

    // التحقق من حالة البائع
    if (vendor.status !== 'active') {
      await supabase.auth.signOut();
      throw new Error('حساب البائع غير نشط. الرجاء التواصل مع الإدارة');
    }

    return {
      user: authData.user,
      vendor: vendor,
      session: authData.session
    };
  } catch (error) {
    console.error('Vendor login error:', error);
    throw error;
  }
};

/**
 * تسجيل خروج البائع
 */
export const vendorLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Vendor logout error:', error);
    throw error;
  }
};

/**
 * الحصول على بيانات البائع الحالي
 */
export const getCurrentVendor = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      if (userError.message?.includes('session_missing') ||
          userError.message?.includes('Auth session missing')) {
        return null;
      }
      throw userError;
    }

    if (!user) return null;

    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendorError) throw vendorError;

    return vendor ? { user, vendor } : null;
  } catch (error) {
    if (error.message?.includes('session_missing') ||
        error.message?.includes('Auth session missing')) {
      return null;
    }
    console.error('Get current vendor error:', error);
    return null;
  }
};

/**
 * التحقق من صلاحيات البائع
 */
export const isVendor = async () => {
  try {
    const currentVendor = await getCurrentVendor();
    return !!currentVendor?.vendor;
  } catch (error) {
    console.error('Check vendor error:', error);
    return false;
  }
};

/**
 * تحديث معلومات البائع
 */
export const updateVendorProfile = async (vendorId, updates) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update vendor profile error:', error);
    throw error;
  }
};
