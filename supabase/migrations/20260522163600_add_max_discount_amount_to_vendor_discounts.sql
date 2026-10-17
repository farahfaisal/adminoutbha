/*
  # Add max_discount_amount to vendor_discounts

  1. Changes
    - Add `max_discount_amount` column: the maximum discount cap applied to any order
      - NULL means no cap (unlimited)
      - e.g. 100 means discount cannot exceed ₪100 regardless of order total
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_discounts' AND column_name = 'max_discount_amount'
  ) THEN
    ALTER TABLE vendor_discounts ADD COLUMN max_discount_amount numeric DEFAULT NULL;
  END IF;
END $$;
