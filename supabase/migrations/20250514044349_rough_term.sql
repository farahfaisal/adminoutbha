/*
  # Fix vendor categories relationships and functions

  1. New Functions
    - Functions to manage vendor-category relationships
    - Functions to query vendor categories data
  
  2. Security
    - Enable RLS on vendor_categories table
    - Add policies for vendors, admins, and public users
*/

-- Make sure RLS is enabled on vendor_categories
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Vendors can manage their own categories" ON vendor_categories;
DROP POLICY IF EXISTS "Admins can manage all vendor categories" ON vendor_categories;
DROP POLICY IF EXISTS "Public can view vendor categories" ON vendor_categories;
DROP POLICY IF EXISTS "Vendor categories are viewable by everyone" ON vendor_categories;

-- Create policies for vendor_categories
CREATE POLICY "Vendors can manage their own categories"
  ON vendor_categories
  FOR ALL
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all vendor categories"
  ON vendor_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendor categories are viewable by everyone"
  ON vendor_categories
  FOR SELECT
  TO public
  USING (true);

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS link_vendor_to_category(UUID, UUID);
DROP FUNCTION IF EXISTS unlink_vendor_from_category(UUID, UUID);
DROP FUNCTION IF EXISTS get_vendor_categories(UUID);
DROP FUNCTION IF EXISTS get_vendors_by_category(UUID);
DROP FUNCTION IF EXISTS link_vendor_to_categories(UUID, UUID[]);
DROP FUNCTION IF EXISTS get_categories_with_vendor_counts();

-- Create function to link vendor to category
CREATE OR REPLACE FUNCTION link_vendor_to_category(
  p_vendor_id UUID,
  p_category_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the link already exists
  IF EXISTS (
    SELECT 1 FROM vendor_categories 
    WHERE vendor_id = p_vendor_id AND category_id = p_category_id
  ) THEN
    RETURN TRUE; -- Already linked
  END IF;

  -- Create the link
  INSERT INTO vendor_categories (vendor_id, category_id)
  VALUES (p_vendor_id, p_category_id);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to unlink vendor from category
CREATE OR REPLACE FUNCTION unlink_vendor_from_category(
  p_vendor_id UUID,
  p_category_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delete the link
  DELETE FROM vendor_categories
  WHERE vendor_id = p_vendor_id AND category_id = p_category_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get vendor categories
CREATE OR REPLACE FUNCTION get_vendor_categories(
  p_vendor_id UUID
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_slug TEXT,
  category_description TEXT,
  category_image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    c.description AS category_description,
    c.image_url AS category_image_url
  FROM 
    vendor_categories vc
    JOIN categories c ON vc.category_id = c.id
  WHERE 
    vc.vendor_id = p_vendor_id
  ORDER BY 
    c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get vendors by category
CREATE OR REPLACE FUNCTION get_vendors_by_category(
  p_category_id UUID
)
RETURNS TABLE (
  vendor_id UUID,
  store_name TEXT,
  logo_url TEXT,
  rating NUMERIC,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id AS vendor_id,
    v.store_name,
    v.logo_url,
    v.rating,
    v.status
  FROM 
    vendor_categories vc
    JOIN vendors v ON vc.vendor_id = v.id
  WHERE 
    vc.category_id = p_category_id
    AND v.status = 'active'
  ORDER BY 
    v.rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to link vendor to multiple categories
CREATE OR REPLACE FUNCTION link_vendor_to_categories(
  p_vendor_id UUID,
  p_category_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Delete existing links
  DELETE FROM vendor_categories
  WHERE vendor_id = p_vendor_id;
  
  -- Create new links
  FOREACH v_category_id IN ARRAY p_category_ids
  LOOP
    INSERT INTO vendor_categories (vendor_id, category_id)
    VALUES (p_vendor_id, v_category_id);
  END LOOP;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get categories with vendor counts
CREATE OR REPLACE FUNCTION get_categories_with_vendor_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  image_url TEXT,
  vendor_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.slug,
    c.description,
    c.image_url,
    COUNT(vc.vendor_id) AS vendor_count
  FROM 
    categories c
    LEFT JOIN vendor_categories vc ON c.id = vc.category_id
  GROUP BY 
    c.id, c.name, c.slug, c.description, c.image_url
  ORDER BY 
    c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;