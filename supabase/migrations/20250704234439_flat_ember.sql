/*
  # Remove constraints on drivers table
  
  1. Changes
    - Remove unique constraints on drivers.phone and drivers.user_id
    - Keep only email constraint as required
    - Update foreign key relationship without unique constraint
    - Add indexes for better query performance
*/

-- Drop existing unique constraints
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_phone_key;
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_user_id_key;
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_email_key;

-- Keep only email constraint
ALTER TABLE drivers ADD CONSTRAINT drivers_email_key UNIQUE (email);

-- Drop existing foreign key constraint
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_user_id_fkey;

-- Add foreign key without unique constraint
ALTER TABLE drivers ADD CONSTRAINT drivers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES custom_users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);

-- Update the create_driver function to handle duplicates
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
  -- Insert driver record without ON CONFLICT clause
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
  RETURNING id INTO v_driver_id;
  
  RETURN v_driver_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle unique constraint violation
    RAISE NOTICE 'Driver with this email already exists';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_driver(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_driver(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon;