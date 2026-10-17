/*
  # Fix Drivers Table Constraints
  
  1. Changes
    - Add unique constraint to drivers.user_id column
    - Ensure proper foreign key relationship between drivers and custom_users
    - Fix ON CONFLICT issues with drivers table
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add unique constraint to drivers.user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_user_id_key' 
    AND conrelid = 'drivers'::regclass
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Ensure foreign key relationship between drivers and custom_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_user_id_fkey' 
    AND conrelid = 'drivers'::regclass
  ) THEN
    ALTER TABLE drivers 
    ADD CONSTRAINT drivers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES custom_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint to drivers.phone if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_phone_key' 
    AND conrelid = 'drivers'::regclass
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Add unique constraint to drivers.email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_email_key' 
    AND conrelid = 'drivers'::regclass
  ) THEN
    -- Make sure email is not null before adding constraint
    UPDATE drivers SET email = 'driver_' || id || '@temp.local' WHERE email IS NULL;
    
    -- Add unique constraint
    ALTER TABLE drivers ADD CONSTRAINT drivers_email_key UNIQUE (email);
  END IF;
END $$;

-- Create or replace function to create driver with proper constraints
CREATE OR REPLACE FUNCTION create_driver(
  p_user_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_password TEXT,
  p_status TEXT DEFAULT 'offline',
  p_vehicle_type TEXT DEFAULT 'motorcycle',
  p_working_areas TEXT[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  -- Insert driver record
  INSERT INTO drivers (
    user_id,
    name,
    phone,
    email,
    password,
    status,
    vehicle_type,
    working_areas
  ) VALUES (
    p_user_id,
    p_name,
    p_phone,
    p_email,
    p_password,
    p_status,
    p_vehicle_type,
    p_working_areas
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    status = EXCLUDED.status,
    vehicle_type = EXCLUDED.vehicle_type,
    working_areas = EXCLUDED.working_areas
  RETURNING id INTO v_driver_id;
  
  RETURN v_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_driver(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_driver(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon;