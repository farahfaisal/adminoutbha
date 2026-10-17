/*
  # Fix vendor email storage
  
  1. Changes
    - Ensure vendor email is properly stored in the vendors table
    - Add missing email column if it doesn't exist
    - Update existing vendors to copy email from custom_users if available
*/

-- Check if email column exists in vendors table, add it if it doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'email'
  ) THEN
    ALTER TABLE vendors ADD COLUMN email text;
  END IF;
END $$;

-- Update existing vendors to copy email from custom_users if available
UPDATE vendors v
SET email = cu.email
FROM custom_users cu
WHERE v.user_id = cu.id
AND v.email IS NULL
AND cu.email IS NOT NULL;

-- Create or replace function to ensure email is copied when creating a vendor
CREATE OR REPLACE FUNCTION ensure_vendor_email()
RETURNS TRIGGER AS $$
BEGIN
  -- If email is NULL but user_id is set, try to get email from custom_users
  IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.email := (SELECT email FROM custom_users WHERE id = NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure email is set before insert or update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'ensure_vendor_email_trigger'
    AND tgrelid = 'vendors'::regclass
  ) THEN
    CREATE TRIGGER ensure_vendor_email_trigger
    BEFORE INSERT OR UPDATE ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION ensure_vendor_email();
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;