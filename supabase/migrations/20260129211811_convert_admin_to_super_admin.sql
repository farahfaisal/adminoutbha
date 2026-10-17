/*
  # Convert Regular Admins to Super Admins

  1. Changes
    - Create function to convert admin_users to super_admins with Supabase Auth
    - This allows admins to login without anonymous authentication
  
  2. Security
    - Only existing admin_users can be converted
    - Requires verification of current password
*/

CREATE OR REPLACE FUNCTION convert_admin_to_super_admin(
  p_username text,
  p_current_password text,
  p_new_email text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_record record;
  v_auth_user_id uuid;
BEGIN
  -- Verify the admin exists and password is correct
  SELECT * INTO v_admin_record
  FROM admin_users
  WHERE username = p_username
  AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin user not found or inactive'
    );
  END IF;

  -- Verify password
  IF NOT (v_admin_record.password_hash = crypt(p_current_password, v_admin_record.password_hash)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid password'
    );
  END IF;

  -- Check if super admin already exists with this email
  IF EXISTS (
    SELECT 1 FROM super_admins WHERE email = p_new_email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Super admin with this email already exists'
    );
  END IF;

  -- Create auth user
  v_auth_user_id := extensions.uuid_generate_v4();

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
    p_new_email,
    crypt(p_new_password, gen_salt('bf')),
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
    p_new_email,
    v_admin_record.full_name,
    'active',
    now()
  );

  -- Mark old admin as migrated
  UPDATE admin_users
  SET 
    status = 'inactive',
    updated_at = now()
  WHERE id = v_admin_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_auth_user_id,
    'email', p_new_email
  );
END;
$$;