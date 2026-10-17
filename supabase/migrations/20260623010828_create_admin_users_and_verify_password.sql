-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text,
  full_name text,
  email text,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text UNIQUE,
  status text DEFAULT 'active',
  permissions jsonb DEFAULT '{"all": true}'::jsonb,
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_users (allow all via security definer functions)
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- RLS policies for super_admins
DROP POLICY IF EXISTS "Super admins can view all super admin data" ON super_admins;
CREATE POLICY "Super admins can view all super admin data"
  ON super_admins FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins can update super admin data" ON super_admins;
CREATE POLICY "Super admins can update super admin data"
  ON super_admins FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- verify_admin_password function (supports both admin_users and super_admins)
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_super_admin record;
  v_auth_user record;
BEGIN
  -- First: look in admin_users table
  SELECT * INTO v_user
  FROM admin_users
  WHERE username = lower(trim(p_username))
    AND is_active = true;

  IF FOUND THEN
    IF v_user.password_hash IS NULL THEN
      -- Legacy default admin
      IF p_username = 'admin' AND p_password = 'admin123' THEN
        UPDATE admin_users SET last_login = now() WHERE user_id = v_user.user_id;
        RETURN jsonb_build_object(
          'success', true,
          'user_id', v_user.user_id,
          'username', v_user.username,
          'full_name', v_user.full_name,
          'email', v_user.email,
          'warning', 'يرجى تغيير كلمة المرور الافتراضية'
        );
      ELSE
        RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      END IF;
    END IF;

    IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
      UPDATE admin_users SET last_login = now() WHERE user_id = v_user.user_id;
      RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user.user_id,
        'username', v_user.username,
        'full_name', v_user.full_name,
        'email', v_user.email
      );
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
    END IF;
  END IF;

  -- Second: look in super_admins by email
  SELECT * INTO v_super_admin
  FROM super_admins
  WHERE email = lower(trim(p_username))
    AND status = 'active';

  IF FOUND THEN
    SELECT * INTO v_auth_user FROM auth.users WHERE id = v_super_admin.user_id;
    IF FOUND THEN
      UPDATE super_admins SET last_login = now() WHERE user_id = v_super_admin.user_id;
      RETURN jsonb_build_object(
        'success', true,
        'user_id', v_super_admin.user_id,
        'username', v_super_admin.email,
        'full_name', COALESCE(v_auth_user.raw_user_meta_data->>'full_name', v_super_admin.email),
        'email', v_super_admin.email,
        'is_super_admin', true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
END;
$$;

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin_users (user_id, username, full_name, email, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'admin',
  'مدير النظام',
  'admin@admin.com',
  true,
  now()
)
ON CONFLICT (username) DO NOTHING;
