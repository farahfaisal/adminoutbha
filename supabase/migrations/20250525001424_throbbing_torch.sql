/*
  # Fix variant products storage

  1. New Columns
    - Add `is_variant_product` boolean column to products table
    - Add `variants_data` JSONB column to products table
  
  2. Indexes
    - Create GIN index on variants_data for efficient querying
  
  3. Data Migration
    - Update existing products to set is_variant_product flag
    - Copy variant data from addons_data to variants_data
*/

-- Add columns for variant products if they don't exist
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS is_variant_product BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS variants_data JSONB DEFAULT '[]'::jsonb;

-- Create index on the variants_data column for efficient querying
CREATE INDEX IF NOT EXISTS idx_products_variants_data ON products USING gin (variants_data);

-- Update existing products to set is_variant_product based on addons_data
DO $$
BEGIN
  UPDATE products
  SET 
    is_variant_product = true,
    variants_data = addons_data->'variants'
  WHERE 
    addons_data IS NOT NULL 
    AND addons_data ? 'variants' 
    AND jsonb_array_length(addons_data->'variants') > 0;
END $$;