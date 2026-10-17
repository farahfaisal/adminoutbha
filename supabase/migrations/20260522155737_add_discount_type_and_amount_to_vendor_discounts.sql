/*
  # Add discount_type and discount_amount to vendor_discounts

  1. Changes
    - Add `discount_type` column: 'percentage' or 'fixed'
    - Add `discount_amount` column: fixed amount value (used when type = 'fixed')
    - Make `discount_percentage` nullable (used when type = 'percentage')
  
  2. Defaults
    - Existing rows default to type 'percentage'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_discounts' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE vendor_discounts ADD COLUMN discount_type text NOT NULL DEFAULT 'percentage';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_discounts' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE vendor_discounts ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE vendor_discounts ALTER COLUMN discount_percentage SET DEFAULT 0;
