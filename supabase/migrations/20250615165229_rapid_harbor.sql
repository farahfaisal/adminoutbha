/*
  # Add preparation_time column to orders table

  1. Changes
    - Add `preparation_time` column to `orders` table
    - Column type: integer (to store preparation time in minutes)
    - Column is nullable to allow existing orders without preparation time
    - Add index for better query performance

  2. Notes
    - This resolves the schema mismatch error where the application tries to update preparation_time on orders
    - Existing orders will have NULL preparation_time initially
    - New orders can have preparation time set based on product preparation times
*/

-- Add preparation_time column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'preparation_time'
  ) THEN
    ALTER TABLE orders ADD COLUMN preparation_time integer;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_preparation_time ON orders(preparation_time);

-- Add comment to the column
COMMENT ON COLUMN orders.preparation_time IS 'Estimated preparation time in minutes for the order';