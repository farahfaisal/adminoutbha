/*
  # Add password field to drivers table

  1. Changes
    - Add password column to drivers table
    - Add constraint to ensure password is at least 6 characters
    
  2. Security
    - Password will be stored in hashed form in custom_users table
    - This field is for direct driver authentication
*/

-- Add password column to drivers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'password'
  ) THEN
    ALTER TABLE drivers ADD COLUMN password text NOT NULL;
    
    -- Add constraint to ensure password is at least 6 characters
    ALTER TABLE drivers ADD CONSTRAINT password_min_length CHECK (length(password) >= 6);
  END IF;
END
$$;

-- Create function to create driver wallet
CREATE OR REPLACE FUNCTION create_driver_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- Create wallet for the new driver
  INSERT INTO driver_wallets (driver_id, balance, total_earnings, total_withdrawals)
  VALUES (NEW.id, 0, 0, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create driver wallet after driver creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_driver_wallet_trigger'
    AND tgrelid = 'drivers'::regclass
  ) THEN
    CREATE TRIGGER create_driver_wallet_trigger
    AFTER INSERT ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION create_driver_wallet();
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END
$$;