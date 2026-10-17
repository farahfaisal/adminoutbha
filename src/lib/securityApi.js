import { supabase } from './supabase';

/**
 * Security API - مكتبة شاملة لإدارة الأمان
 */

// تسجيل محاولة دخول
export const logLoginAttempt = async (username, success = false, errorMessage = null) => {
  try {
    const { error } = await supabase.rpc('log_login_attempt', {
      p_username: username,
      p_ip_address: await getClientIP(),
      p_user_agent: navigator.userAgent,
      p_success: success,
      p_error_message: errorMessage
    });

    if (error) {
      console.error('Error logging login attempt:', error);
    }
  } catch (err) {
    console.error('Exception logging login attempt:', err);
  }
};

// فحص معدل المحاولات (Rate Limiting)
export const checkRateLimit = async (username) => {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_username: username,
      p_ip_address: await getClientIP(),
      p_max_attempts: 5,
      p_time_window_minutes: 15
    });

    if (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true }; // في حالة الخطأ، السماح بالمحاولة
    }

    return data;
  } catch (err) {
    console.error('Exception checking rate limit:', err);
    return { allowed: true };
  }
};

// تسجيل دخول آمن
export const secureLogin = async (username, password) => {
  try {
    const { data, error } = await supabase.rpc('secure_login', {
      p_username: username,
      p_password: password,
      p_ip_address: await getClientIP(),
      p_user_agent: navigator.userAgent
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.success) {
      throw new Error(data.error || 'فشل تسجيل الدخول');
    }

    return data;
  } catch (err) {
    console.error('Secure login error:', err);
    throw err;
  }
};

// التحقق من صلاحية الجلسة
export const validateSession = async (sessionToken) => {
  try {
    const { data, error } = await supabase.rpc('validate_session', {
      p_session_token: sessionToken
    });

    if (error) {
      console.error('Error validating session:', error);
      return { valid: false };
    }

    return data;
  } catch (err) {
    console.error('Exception validating session:', err);
    return { valid: false };
  }
};

// إنهاء الجلسة
export const endSession = async (sessionToken) => {
  try {
    const { data, error } = await supabase.rpc('end_session', {
      p_session_token: sessionToken
    });

    if (error) {
      console.error('Error ending session:', error);
      return false;
    }

    return data;
  } catch (err) {
    console.error('Exception ending session:', err);
    return false;
  }
};

// إنهاء جميع الجلسات (مفيد عند تغيير كلمة المرور)
export const endAllUserSessions = async (userId) => {
  try {
    const { data, error } = await supabase.rpc('end_all_user_sessions', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error ending all sessions:', error);
      return 0;
    }

    return data;
  } catch (err) {
    console.error('Exception ending all sessions:', err);
    return 0;
  }
};

// تسجيل حدث في سجل التدقيق
export const logAuditEvent = async (
  userId,
  action,
  tableName = null,
  recordId = null,
  oldData = null,
  newData = null,
  severity = 'info'
) => {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_user_id: userId,
      p_action: action,
      p_table_name: tableName,
      p_record_id: recordId,
      p_old_data: oldData,
      p_new_data: newData,
      p_ip_address: await getClientIP(),
      p_user_agent: navigator.userAgent,
      p_severity: severity
    });

    if (error) {
      console.error('Error logging audit event:', error);
    }

    return data;
  } catch (err) {
    console.error('Exception logging audit event:', err);
  }
};

// الحصول على عنوان IP للعميل
const getClientIP = async () => {
  try {
    // محاولة الحصول على IP من خدمة خارجية
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (err) {
    // في حالة الفشل، إرجاع قيمة افتراضية
    return 'unknown';
  }
};

// الحصول على محاولات الدخول الأخيرة
export const getRecentLoginAttempts = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .order('attempted_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching login attempts:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching login attempts:', err);
    return [];
  }
};

// الحصول على الجلسات النشطة
export const getActiveSessions = async () => {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching active sessions:', err);
    return [];
  }
};

// الحصول على سجل التدقيق
export const getAuditLogs = async (filters = {}) => {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    // تطبيق الفلاتر
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching audit logs:', err);
    return [];
  }
};

// فحص النشاطات المشبوهة
export const detectSuspiciousActivity = async () => {
  try {
    // محاولات دخول فاشلة متعددة
    const { data: failedAttempts, error: attemptsError } = await supabase
      .from('login_attempts')
      .select('username, ip_address, count')
      .eq('success', false)
      .gte('attempted_at', new Date(Date.now() - 3600000).toISOString()); // آخر ساعة

    // تنبيهات أمنية من سجل التدقيق
    const { data: criticalEvents, error: eventsError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('severity', 'critical')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()); // آخر 24 ساعة

    return {
      failedAttempts: failedAttempts || [],
      criticalEvents: criticalEvents || [],
      hasIssues: (failedAttempts?.length > 0) || (criticalEvents?.length > 0)
    };
  } catch (err) {
    console.error('Exception detecting suspicious activity:', err);
    return {
      failedAttempts: [],
      criticalEvents: [],
      hasIssues: false
    };
  }
};

// تنظيف السجلات القديمة (يجب أن يتم جدولتها لتعمل دورياً)
export const cleanupOldSecurityLogs = async () => {
  try {
    const { error } = await supabase.rpc('cleanup_old_security_logs');

    if (error) {
      console.error('Error cleaning up security logs:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception cleaning up security logs:', err);
    return false;
  }
};

// تصدير إحصائيات الأمان
export const getSecurityStats = async () => {
  try {
    const now = new Date();
    const last24Hours = new Date(now - 86400000);
    const last7Days = new Date(now - 604800000);

    // محاولات الدخول
    const { count: totalAttempts } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true });

    const { count: failedAttempts24h } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('success', false)
      .gte('attempted_at', last24Hours.toISOString());

    // الجلسات النشطة
    const { count: activeSessions } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('expires_at', now.toISOString());

    // أحداث التدقيق
    const { count: auditEvents7d } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last7Days.toISOString());

    const { count: criticalEvents7d } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .gte('created_at', last7Days.toISOString());

    return {
      totalLoginAttempts: totalAttempts || 0,
      failedAttempts24h: failedAttempts24h || 0,
      activeSessions: activeSessions || 0,
      auditEvents7d: auditEvents7d || 0,
      criticalEvents7d: criticalEvents7d || 0
    };
  } catch (err) {
    console.error('Exception getting security stats:', err);
    return {
      totalLoginAttempts: 0,
      failedAttempts24h: 0,
      activeSessions: 0,
      auditEvents7d: 0,
      criticalEvents7d: 0
    };
  }
};

export default {
  logLoginAttempt,
  checkRateLimit,
  secureLogin,
  validateSession,
  endSession,
  endAllUserSessions,
  logAuditEvent,
  getRecentLoginAttempts,
  getActiveSessions,
  getAuditLogs,
  detectSuspiciousActivity,
  cleanupOldSecurityLogs,
  getSecurityStats
};
