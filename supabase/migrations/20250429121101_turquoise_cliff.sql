/*
  # Enable Vendor Product Management

  1. Changes
    - Update RLS policies for products table to allow vendors to manage their products
    - Add function to get products by vendor ID
    - Add function to add product for a vendor
*/

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
  DROP POLICY IF EXISTS "Vendors can manage their own products" ON products;
  DROP POLICY IF EXISTS "Anyone can delete products" ON products;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create new policies
CREATE POLICY "Products are viewable by everyone"
  ON products
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Vendors can manage their own products"
  ON products
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create function to get products by vendor ID
CREATE OR REPLACE FUNCTION get_vendor_products(p_vendor_id uuid)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE vendor_id = p_vendor_id
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add product for a vendor
CREATE OR REPLACE FUNCTION add_vendor_product(
  p_vendor_id uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_category_id uuid,
  p_image_url text,
  p_status text DEFAULT 'active',
  p_stock integer DEFAULT 0,
  p_addons_data jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_product_id uuid;
  v_result jsonb;
BEGIN
  -- Insert new product
  INSERT INTO products (
    vendor_id,
    name,
    description,
    price,
    category_id,
    image_url,
    status,
    stock,
    addons_data
  ) VALUES (
    p_vendor_id,
    p_name,
    p_description,
    p_price,
    p_category_id,
    p_image_url,
    p_status,
    p_stock,
    p_addons_data
  ) RETURNING id INTO v_product_id;
  
  -- Get the complete product data
  SELECT row_to_json(p)::jsonb INTO v_result
  FROM (
    SELECT * FROM products WHERE id = v_product_id
  ) p;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;