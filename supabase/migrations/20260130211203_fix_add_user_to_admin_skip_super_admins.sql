/*
  # Fix add_user_to_admin trigger to skip Super Admins
  
  1. Changes
    - Update add_user_to_admin function to check if user is a Super Admin first
    - If user is being created as Super Admin, skip adding to admin_users
    - This prevents duplicate key violations
  
  2. Security
    - Maintains automatic admin_users creation for regular users
    - Super Admins are managed separately through super_admins table
*/

-- Update the function to skip Super Admins
CREATE OR REPLACE FUNCTION add_user_to_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_is_super_admin boolean;
BEGIN
  -- Check if this user is being created as a Super Admin
  -- We check if super_admins record exists for this user_id
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = NEW.id
  ) INTO v_is_super_admin;
  
  -- Only add to admin_users if NOT a Super Admin
  IF NOT v_is_super_admin THEN
    INSERT INTO admin_users (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
