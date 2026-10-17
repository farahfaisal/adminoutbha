/*
  # Fix driver wallet unique constraint

  1. Database Changes
    - Add unique constraint on driver_id in driver_wallets table
    - This will allow ON CONFLICT clauses to work properly when creating driver wallets

  2. Security
    - No changes to existing RLS policies
*/

-- Add unique constraint to driver_id in driver_wallets table
ALTER TABLE driver_wallets 
ADD CONSTRAINT driver_wallets_driver_id_unique UNIQUE (driver_id);