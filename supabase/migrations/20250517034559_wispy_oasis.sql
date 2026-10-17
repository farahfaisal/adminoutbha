/*
  # Fix wallet queries and relationships

  1. Changes
    - Remove RPC function dependency
    - Update wallet transactions query
    
  2. Security
    - Maintain existing RLS policies
*/

-- Remove any existing RPC function if it exists
DROP FUNCTION IF EXISTS public.get_all_vendor_wallets();

-- Add missing foreign key relationship for wallet_transactions if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallet_transactions_order_id_fkey'
  ) THEN
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;