/*
  # Create Super Admin Directly

  1. Changes
    - Create function to create a new super admin without needing old admin password
    - Useful when you don't remember the old password or want to create a fresh super admin
  
  2. Security
    - Can only be run through SQL Editor (requires database access)
    - Creates both auth user and super_admins record
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

  -- Create auth user
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
END;
$$;