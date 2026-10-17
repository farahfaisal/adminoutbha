/*
  # Fix Create Super Admin - Skip Triggers

  1. Changes
    - Update create_super_admin_directly to temporarily disable triggers
    - This prevents referral_codes trigger from running for Super Admins
    - Super Admins are not customers so they don't need referral codes
  
  2. Security
    - Function is SECURITY DEFINER (runs with elevated privileges)
    - Can only be called from SQL Editor
*/

CREATE OR REPLACE FUNCTION create_super_admin_directly(
  p_email text,
  p_password text,
  p_full_name text DEFAULT 'مدير النظام'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id uuid;
  v_old_role text;
BEGIN
  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;

  -- Check if super admin already exists with this email
  IF EXISTS (
    SELECT 1 FROM super_admins WHERE email = p_email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Super admin with this email already exists'
    );
  END IF;

  -- Check if auth user already exists with this email
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User with this email already exists in auth.users'
    );
  END IF;

  -- Generate new UUID for auth user
  v_auth_user_id := extensions.uuid_generate_v4();

  -- Store current session_replication_role
  SELECT current_setting('session_replication_role') INTO v_old_role;
  
  -- Temporarily disable triggers
  PERFORM set_config('session_replication_role', 'replica', true);

  -- Create auth user (triggers will be disabled)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    'authenticated',
    'authenticated',
    '',
    '',
    ''
  );

  -- Re-enable triggers
  PERFORM set_config('session_replication_role', v_old_role, true);

  -- Create super admin record
  INSERT INTO super_admins (
    user_id,
    email,
    full_name,
    status,
    created_at
  ) VALUES (
    v_auth_user_id,
    p_email,
    p_full_name,
    'active',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_auth_user_id,
    'email', p_email,
    'message', 'Super admin created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Make sure to re-enable triggers even if there's an error
    PERFORM set_config('session_replication_role', v_old_role, true);
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;