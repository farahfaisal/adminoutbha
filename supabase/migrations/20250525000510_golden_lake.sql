/*
  # Add variant product support
  
  1. New Columns
    - `is_variant_product` - Boolean flag indicating if product has multiple variants
    - `variants_data` - JSONB array storing variant information (name, price, stock, etc.)
  
  2. Changes
    - Creates index on variants_data for better query performance
    - Updates existing products to set is_variant_product flag based on addons_data
*/

-- Add columns for variant products
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS is_variant_product BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS variants_data JSONB DEFAULT '[]'::jsonb;

-- Add column descriptions
COMMENT ON COLUMN products.is_variant_product IS 'يشير إلى ما إذا كان المنتج يحتوي على أنواع متعددة';
COMMENT ON COLUMN products.variants_data IS 'بيانات الأنواع المختلفة للمنتج (الاسم، السعر، المخزون، إلخ)';

-- Create index on the new columns
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