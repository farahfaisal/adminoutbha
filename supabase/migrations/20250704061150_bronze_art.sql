/*
  # Fix Driver Table Constraints

  1. Database Changes
    - Remove duplicate unique constraints on drivers table
    - Ensure proper unique constraints exist for phone and email
    - Add proper indexes for performance

  2. Security
    - Maintain existing RLS policies
    - No changes to security model
*/

-- First, let's drop the duplicate constraints if they exist
DO $$
BEGIN
  -- Drop duplicate unique constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_driver_phone' 
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers DROP CONSTRAINT unique_driver_phone;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_driver_email' 
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers DROP CONSTRAINT unique_driver_email;
  END IF;
END $$;

-- Ensure the main unique constraints exist
DO $$
BEGIN
  -- Ensure phone unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'drivers_phone_key' 
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_phone_key UNIQUE (phone);
  END IF;

  -- Ensure email unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'drivers_email_key' 
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_email_key UNIQUE (email);
  END IF;
END $$;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_drivers_phone_unique ON drivers (phone);
CREATE INDEX IF NOT EXISTS idx_drivers_email_unique ON drivers (email);