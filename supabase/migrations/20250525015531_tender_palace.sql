/*
  # Add variant product display columns
  
  1. New Columns
    - `variant_name` (text) - Name of the variant for variant products
    - `variant_price` (numeric) - Price of the variant for variant products
    - `variant_image_url` (text) - Image URL of the variant for variant products
  
  2. Changes
    - Adds columns to store variant information directly in the products table
    - Creates indexes for efficient querying
*/

-- Add columns for variant product display information
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS variant_name TEXT;

ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS variant_price NUMERIC(10,2);

ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS variant_image_url TEXT;

-- Add column descriptions
COMMENT ON COLUMN products.variant_name IS 'اسم النوع للمنتج المتعدد الأنواع';
COMMENT ON COLUMN products.variant_price IS 'سعر النوع للمنتج المتعدد الأنواع';
COMMENT ON COLUMN products.variant_image_url IS 'رابط صورة النوع للمنتج المتعدد الأنواع';

-- Create indexes on the new columns
CREATE INDEX IF NOT EXISTS idx_products_variant_name ON products USING btree (variant_name);
CREATE INDEX IF NOT EXISTS idx_products_variant_price ON products USING btree (variant_price);

-- Update existing variant products to set variant information from variants_data
-- This will extract the first variant's information as a default display
DO $$
BEGIN
  UPDATE products
  SET 
    variant_name = (variants_data->0->>'name'),
    variant_price = (variants_data->0->>'price')::numeric,
    variant_image_url = (variants_data->0->>'image')
  WHERE 
    is_variant_product = true 
    AND variants_data IS NOT NULL 
    AND jsonb_array_length(variants_data) > 0;
END $$;