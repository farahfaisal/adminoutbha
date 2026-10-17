/*
  # Add payment_type column to wallet_transactions table

  1. Changes
    - Add `payment_type` column to `wallet_transactions` table
    - The column will be of type `text` with a default value of 'cash'
    - Add a check constraint to ensure the payment_type is one of the allowed values
*/

-- Add payment_type column to wallet_transactions table
ALTER TABLE IF EXISTS public.wallet_transactions
ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'cash';

-- Add check constraint for valid payment types
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_payment_type_check'
  ) THEN
    ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_payment_type_check
    CHECK (payment_type = ANY (ARRAY['cash'::text, 'electronic'::text, 'wallet'::text]));
  END IF;
END $$;

-- Update any existing wallet transactions to have the default payment type
UPDATE public.wallet_transactions
SET payment_type = 'cash'
WHERE payment_type IS NULL;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.wallet_transactions.payment_type IS 'The payment method used for this transaction (cash, electronic, wallet)';