/*
  # Add parcel value column to parcel_orders
  
  1. Changes
    - Add `parcel_value` column to `parcel_orders` table
      - Type: numeric (to store decimal values)
      - Default: 0
      - Description: Stores the declared value of the parcel for insurance purposes
  
  2. Notes
    - The parcel value is different from delivery fee
    - This is the actual worth/value of the contents of the parcel
*/

-- Add parcel_value column to parcel_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcel_orders' AND column_name = 'parcel_value'
  ) THEN
    ALTER TABLE parcel_orders 
    ADD COLUMN parcel_value numeric DEFAULT 0;
  END IF;
END $$;