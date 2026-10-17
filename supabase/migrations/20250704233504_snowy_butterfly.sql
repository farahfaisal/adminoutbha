/*
  # Fix Driver Table Constraints
  
  1. Changes
    - Remove unique constraints on drivers table except for email
    - Fix ON CONFLICT issues when adding drivers
    - Ensure proper foreign key relationship with custom_users
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

-- Update the add_custom_user function to be more flexible
CREATE OR REPLACE FUNCTION add_custom_user(
  p_username text,
  p_password text,
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'customer'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if username exists
  IF EXISTS (SELECT 1 FROM custom_users WHERE username = p_username) THEN
    -- Generate a unique username by adding a random suffix
    p_username := p_username || '_' || substring(md5(random()::text), 1, 6);
  END IF;
  
  -- Insert the new user
  INSERT INTO custom_users (
    username,
    password,
    password_hash,
    name,
    email,
    phone,
    role,
    status
  ) VALUES (
    p_username,
    p_password,
    encode(sha256(p_password::bytea), 'hex'),
    p_name,
    p_email,
    p_phone,
    p_role,
    'active'
  ) RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;