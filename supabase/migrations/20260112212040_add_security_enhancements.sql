/*
  # تحسينات الأمان الشاملة

  ## التغييرات
  
  1. جدول محاولات تسجيل الدخول
    - تتبع محاولات الدخول الفاشلة
    - منع هجمات Brute Force
    - تسجيل عناوين IP
  
  2. جدول جلسات المستخدمين
    - إدارة الجلسات بشكل آمن
    - تتبع الجلسات النشطة
    - إمكانية إنهاء الجلسات عن بعد
  
  3. جدول سجل التدقيق (Audit Log)
    - تسجيل جميع العمليات الحساسة
    - مراقبة النشاطات المشبوهة
    - الامتثال للمعايير الأمنية
  
  4. دالة فحص معدل المحاولات
    - حماية من Brute Force
    - حظر مؤقت بعد محاولات فاشلة
  
  5. دالة تسجيل الأحداث الأمنية
    - تتبع العمليات الحساسة
    - كشف الأنماط المشبوهة
  
  6. سياسات RLS صارمة
    - حماية البيانات الحساسة
    - صلاحيات محدودة
*/

-- إنشاء جدول محاولات تسجيل الدخول
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean DEFAULT false,
  error_message text,
  attempted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- إنشاء جدول جلسات المستخدمين
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- إنشاء جدول سجل التدقيق (Audit Log)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  severity text DEFAULT 'info', -- info, warning, critical
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- تفعيل RLS على الجداول الجديدة
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسات RLS - فقط المشرفين يمكنهم الوصول
CREATE POLICY "Admins can view login attempts"
  ON login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view user sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage user sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- دالة لتسجيل محاولات الدخول
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_username text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT false,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO login_attempts (
    username,
    ip_address,
    user_agent,
    success,
    error_message
  ) VALUES (
    p_username,
    p_ip_address,
    p_user_agent,
    p_success,
    p_error_message
  );
END;
$$;

-- دالة لفحص معدل المحاولات (Rate Limiting)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_username text,
  p_ip_address text DEFAULT NULL,
  p_max_attempts integer DEFAULT 5,
  p_time_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts_by_username integer;
  v_attempts_by_ip integer;
  v_blocked_until timestamptz;
BEGIN
  -- فحص عدد المحاولات الفاشلة بناءً على اسم المستخدم
  SELECT COUNT(*)
  INTO v_attempts_by_username
  FROM login_attempts
  WHERE username = p_username
    AND success = false
    AND attempted_at > now() - (p_time_window_minutes || ' minutes')::interval;
  
  -- فحص عدد المحاولات الفاشلة بناءً على IP
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_attempts_by_ip
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND success = false
      AND attempted_at > now() - (p_time_window_minutes || ' minutes')::interval;
  ELSE
    v_attempts_by_ip := 0;
  END IF;
  
  -- إذا تجاوز عدد المحاولات الحد المسموح
  IF v_attempts_by_username >= p_max_attempts OR v_attempts_by_ip >= p_max_attempts THEN
    -- حساب وقت الحظر
    v_blocked_until := now() + (p_time_window_minutes || ' minutes')::interval;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'attempts_remaining', 0,
      'blocked_until', v_blocked_until,
      'message', 'تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة بعد ' || p_time_window_minutes || ' دقيقة'
    );
  END IF;
  
  -- إرجاع معلومات المحاولات المتبقية
  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_remaining', p_max_attempts - GREATEST(v_attempts_by_username, v_attempts_by_ip),
    'blocked_until', NULL,
    'message', 'يمكنك المحاولة'
  );
END;
$$;

-- دالة لتسجيل أحداث التدقيق
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id uuid,
  p_action text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_severity text DEFAULT 'info'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    severity
  ) VALUES (
    p_user_id,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
    p_ip_address,
    p_user_agent,
    p_severity
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- دالة لتنظيف السجلات القديمة (تشغل دورياً)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- حذف محاولات الدخول القديمة (أكثر من 90 يوم)
  DELETE FROM login_attempts
  WHERE attempted_at < now() - interval '90 days';
  
  -- حذف الجلسات المنتهية (أكثر من 30 يوم)
  DELETE FROM user_sessions
  WHERE expires_at < now() - interval '30 days';
  
  -- حذف سجلات التدقيق القديمة (أكثر من 1 سنة) - ما عدا الحرجة
  DELETE FROM audit_logs
  WHERE created_at < now() - interval '1 year'
    AND severity != 'critical';
END;
$$;

-- دالة محسّنة لتسجيل الدخول مع أمان معزز
CREATE OR REPLACE FUNCTION secure_login(
  p_username text,
  p_password text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate_limit jsonb;
  v_user_record record;
  v_session_token text;
  v_session_id uuid;
BEGIN
  -- 1. فحص معدل المحاولات أولاً
  v_rate_limit := check_rate_limit(p_username, p_ip_address);
  
  IF NOT (v_rate_limit->>'allowed')::boolean THEN
    -- تسجيل محاولة محظورة
    PERFORM log_login_attempt(
      p_username,
      p_ip_address,
      p_user_agent,
      false,
      v_rate_limit->>'message'
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_rate_limit->>'message',
      'blocked_until', v_rate_limit->>'blocked_until'
    );
  END IF;
  
  -- 2. محاولة تسجيل الدخول
  BEGIN
    SELECT *
    INTO v_user_record
    FROM custom_users
    WHERE username = p_username
      AND password = p_password
      AND is_active = true;
    
    IF NOT FOUND THEN
      -- تسجيل محاولة فاشلة
      PERFORM log_login_attempt(
        p_username,
        p_ip_address,
        p_user_agent,
        false,
        'اسم المستخدم أو كلمة المرور غير صحيحة'
      );
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'اسم المستخدم أو كلمة المرور غير صحيحة'
      );
    END IF;
    
    -- 3. تسجيل نجاح
    PERFORM log_login_attempt(
      p_username,
      p_ip_address,
      p_user_agent,
      true,
      NULL
    );
    
    -- 4. إنشاء جلسة جديدة
    v_session_token := encode(gen_random_bytes(32), 'base64');
    
    INSERT INTO user_sessions (
      user_id,
      session_token,
      ip_address,
      user_agent,
      expires_at
    ) VALUES (
      v_user_record.id,
      v_session_token,
      p_ip_address,
      p_user_agent,
      now() + interval '24 hours'
    ) RETURNING id INTO v_session_id;
    
    -- 5. تسجيل في سجل التدقيق
    PERFORM log_audit_event(
      v_user_record.id,
      'login',
      'custom_users',
      v_user_record.id,
      NULL,
      jsonb_build_object('username', p_username),
      p_ip_address,
      p_user_agent,
      'info'
    );
    
    -- 6. إرجاع بيانات المستخدم والجلسة
    RETURN jsonb_build_object(
      'success', true,
      'user', jsonb_build_object(
        'id', v_user_record.id,
        'username', v_user_record.username,
        'name', v_user_record.name,
        'email', v_user_record.email,
        'role', v_user_record.role
      ),
      'session', jsonb_build_object(
        'token', v_session_token,
        'expires_at', now() + interval '24 hours'
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- تسجيل خطأ غير متوقع
    PERFORM log_login_attempt(
      p_username,
      p_ip_address,
      p_user_agent,
      false,
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء تسجيل الدخول'
    );
  END;
END;
$$;

-- دالة للتحقق من صلاحية الجلسة
CREATE OR REPLACE FUNCTION validate_session(
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record record;
BEGIN
  SELECT *
  INTO v_session_record
  FROM user_sessions
  WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'الجلسة غير صالحة أو منتهية'
    );
  END IF;
  
  -- تحديث آخر نشاط
  UPDATE user_sessions
  SET last_activity = now()
  WHERE id = v_session_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_session_record.user_id,
    'expires_at', v_session_record.expires_at
  );
END;
$$;

-- دالة لإنهاء الجلسة (Logout)
CREATE OR REPLACE FUNCTION end_session(
  p_session_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE session_token = p_session_token;
  
  RETURN FOUND;
END;
$$;

-- دالة لإنهاء جميع جلسات المستخدم (مفيد عند تغيير كلمة المرور)
CREATE OR REPLACE FUNCTION end_all_user_sessions(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE user_id = p_user_id
    AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- تسجيل في سجل التدقيق
  PERFORM log_audit_event(
    p_user_id,
    'end_all_sessions',
    'user_sessions',
    NULL,
    NULL,
    jsonb_build_object('sessions_ended', v_count),
    NULL,
    NULL,
    'warning'
  );
  
  RETURN v_count;
END;
$$;