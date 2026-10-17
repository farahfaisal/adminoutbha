/*
  # Fix driver authentication and permissions

  1. New Functions
    - `add_driver_to_auth_users`: Adds a driver to auth.users table
    - `authenticate_driver`: Authenticates a driver with phone and password
    - `login_driver`: Wrapper for authenticate_driver
    - `register_driver_in_auth`: Registers a driver in auth system
  
  2. Security
    - Add policies for drivers to access their own data
    - Create trigger to automatically add drivers to auth.users
*/

-- Create function to add a driver to auth.users
CREATE OR REPLACE FUNCTION add_driver_to_auth_users(
  p_driver_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_driver RECORD;
  v_user_id UUID;
BEGIN
  -- Get driver
  SELECT * INTO v_driver
  FROM drivers
  WHERE id = p_driver_id;
  
  -- Check if driver exists
  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Check if driver already has a user_id
  IF v_driver.user_id IS NOT NULL THEN
    -- Check if user exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE id = v_driver.user_id;
    
    IF v_user_id IS NOT NULL THEN
      -- User already exists in auth.users
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Create user in auth.users
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    v_driver.user_id,
    COALESCE(v_driver.email, v_driver.phone || '@example.com'),
    jsonb_build_object(
      'name', v_driver.name,
      'phone', v_driver.phone,
      'role', 'driver'
    ),
    now(),
    now()
  );
  
  -- Return success
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding driver to auth.users: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to authenticate a driver
CREATE OR REPLACE FUNCTION authenticate_driver(
  p_phone TEXT,
  p_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_driver RECORD;
  v_user RECORD;
  v_custom_user RECORD;
  v_password_valid BOOLEAN;
BEGIN
  -- Get driver by phone
  SELECT * INTO v_driver
  FROM drivers
  WHERE phone = p_phone;
  
  -- Check if driver exists
  IF v_driver.id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Invalid credentials'
    );
  END IF;
  
  -- Get custom user
  SELECT * INTO v_custom_user
  FROM custom_users
  WHERE id = v_driver.user_id;
  
  -- Check if custom user exists
  IF v_custom_user.id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'User account not found'
    );
  END IF;
  
  -- Verify password
  SELECT password_hash = crypt(p_password, password_hash) INTO v_password_valid
  FROM custom_users
  WHERE id = v_driver.user_id;
  
  IF NOT v_password_valid THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Invalid credentials'
    );
  END IF;
  
  -- Ensure driver is in auth.users
  PERFORM add_driver_to_auth_users(v_driver.id);
  
  -- Get user from auth.users
  SELECT * INTO v_user
  FROM auth.users
  WHERE id = v_driver.user_id;
  
  -- Return user data
  RETURN json_build_object(
    'success', TRUE,
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'name', v_driver.name,
      'phone', v_driver.phone,
      'role', 'driver',
      'driver_id', v_driver.id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy to allow drivers to access their own data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Drivers can view their own data'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Drivers can view their own data"
      ON drivers
      FOR SELECT
      TO authenticated
      USING (
        (user_id = auth.uid()) OR
        (EXISTS (SELECT 1 FROM custom_users WHERE id = auth.uid() AND role = 'admin'))
      );
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Drivers can update their own data'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Drivers can update their own data"
      ON drivers
      FOR UPDATE
      TO authenticated
      USING (
        (user_id = auth.uid()) OR
        (EXISTS (SELECT 1 FROM custom_users WHERE id = auth.uid() AND role = 'admin'))
      );
    $policy$;
  END IF;
END $$;

-- Create function to login driver
CREATE OR REPLACE FUNCTION login_driver(
  p_phone TEXT,
  p_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Authenticate driver
  SELECT authenticate_driver(p_phone, p_password) INTO v_result;
  
  -- Return result
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to register driver in auth system
CREATE OR REPLACE FUNCTION register_driver_in_auth(
  p_driver_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add driver to auth.users
  RETURN add_driver_to_auth_users(p_driver_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically add drivers to auth.users when created
CREATE OR REPLACE FUNCTION trigger_add_driver_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Add driver to auth.users
  PERFORM add_driver_to_auth_users(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'add_driver_to_auth' AND tgrelid = 'drivers'::regclass
  ) THEN
    CREATE TRIGGER add_driver_to_auth
    AFTER INSERT ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_add_driver_to_auth();
  END IF;
END $$;

-- Add existing drivers to auth.users
DO $$
DECLARE
  v_driver RECORD;
BEGIN
  FOR v_driver IN SELECT id FROM drivers LOOP
    BEGIN
      PERFORM add_driver_to_auth_users(v_driver.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error adding driver % to auth.users: %', v_driver.id, SQLERRM;
    END;
  END LOOP;
END;
$$;