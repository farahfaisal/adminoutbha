import { supabase } from './supabase';

/**
 * Admin Users API - إدارة مستخدمي لوحة التحكم
 */

// التحقق من قوة كلمة المرور
export const validatePasswordStrength = async (password) => {
  try {
    const { data, error } = await supabase.rpc('validate_password_strength', {
      p_password: password
    });

    if (error) {
      console.error('Error validating password:', error);
      return {
        valid: false,
        errors: ['فشل التحقق من كلمة المرور']
      };
    }

    return data;
  } catch (err) {
    console.error('Exception validating password:', err);
    return {
      valid: false,
      errors: ['فشل التحقق من كلمة المرور']
    };
  }
};

// إنشاء مستخدم جديد
export const createAdminUser = async (userData) => {
  try {
    const { data, error } = await supabase.rpc('create_admin_user', {
      p_username: userData.username,
      p_password: userData.password,
      p_full_name: userData.fullName,
      p_email: userData.email || null,
      p_created_by: userData.createdBy || null
    });

    if (error) {
      console.error('Error creating admin user:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return data;
  } catch (err) {
    console.error('Exception creating admin user:', err);
    return {
      success: false,
      error: 'فشل إنشاء المستخدم'
    };
  }
};

// تحديث كلمة المرور
export const updateAdminPassword = async (username, oldPassword, newPassword) => {
  try {
    const { data, error } = await supabase.rpc('update_admin_password', {
      p_username: username,
      p_old_password: oldPassword,
      p_new_password: newPassword
    });

    if (error) {
      console.error('Error updating password:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return data;
  } catch (err) {
    console.error('Exception updating password:', err);
    return {
      success: false,
      error: 'فشل تحديث كلمة المرور'
    };
  }
};

// التحقق من كلمة المرور
export const verifyAdminPassword = async (username, password) => {
  try {
    const { data, error } = await supabase.rpc('verify_admin_password', {
      p_username: username,
      p_password: password
    });

    if (error) {
      console.error('Error verifying password:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return data;
  } catch (err) {
    console.error('Exception verifying password:', err);
    return {
      success: false,
      error: 'فشل التحقق من كلمة المرور'
    };
  }
};

// عرض جميع المستخدمين
export const listAdminUsers = async () => {
  try {
    const { data, error } = await supabase.rpc('list_admin_users');

    if (error) {
      console.error('Error listing admin users:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception listing admin users:', err);
    return [];
  }
};

// تفعيل/تعطيل مستخدم
export const toggleAdminUserStatus = async (username, isActive, updatedBy) => {
  try {
    const { data, error } = await supabase.rpc('toggle_admin_user_status', {
      p_username: username,
      p_is_active: isActive,
      p_updated_by: updatedBy
    });

    if (error) {
      console.error('Error toggling user status:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return data;
  } catch (err) {
    console.error('Exception toggling user status:', err);
    return {
      success: false,
      error: 'فشل تحديث حالة المستخدم'
    };
  }
};

// حذف مستخدم
export const deleteAdminUser = async (username, deletedBy) => {
  try {
    const { data, error } = await supabase.rpc('delete_admin_user', {
      p_username: username,
      p_deleted_by: deletedBy
    });

    if (error) {
      console.error('Error deleting admin user:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return data;
  } catch (err) {
    console.error('Exception deleting admin user:', err);
    return {
      success: false,
      error: 'فشل حذف المستخدم'
    };
  }
};

// مولد كلمات مرور عشوائية آمنة
export const generateSecurePassword = (length = 16) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = uppercase + lowercase + numbers + special;
  let password = '';

  // ضمان وجود حرف واحد على الأقل من كل نوع
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // ملء باقي الطول
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // خلط الأحرف
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// التحقق من قوة كلمة المرور محلياً (للتغذية البصرية الفورية)
export const checkPasswordStrengthLocal = (password) => {
  const length = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let score = 0;
  const errors = [];

  if (length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  } else {
    score++;
  }

  if (!hasUpper) {
    errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
  } else {
    score++;
  }

  if (!hasLower) {
    errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
  } else {
    score++;
  }

  if (!hasDigit) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل (0-9)');
  } else {
    score++;
  }

  if (hasSpecial) {
    score++;
  }

  if (length >= 12) {
    score++;
  }

  let strength = 'ضعيفة';
  let color = 'red';

  if (score <= 2) {
    strength = 'ضعيفة';
    color = 'red';
  } else if (score <= 4) {
    strength = 'متوسطة';
    color = 'orange';
  } else if (score <= 5) {
    strength = 'قوية';
    color = 'yellow';
  } else {
    strength = 'قوية جداً';
    color = 'green';
  }

  return {
    valid: errors.length === 0,
    score,
    strength,
    color,
    errors,
    percentage: (score / 6) * 100
  };
};

export default {
  validatePasswordStrength,
  createAdminUser,
  updateAdminPassword,
  verifyAdminPassword,
  listAdminUsers,
  toggleAdminUserStatus,
  deleteAdminUser,
  generateSecurePassword,
  checkPasswordStrengthLocal
};
