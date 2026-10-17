-- Create vendor_categories_table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_categories_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE vendor_categories_table ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Vendor categories table is viewable by everyone" ON vendor_categories_table;
DROP POLICY IF EXISTS "Admins can manage vendor categories table" ON vendor_categories_table;

-- Create policies
CREATE POLICY "Vendor categories table is viewable by everyone"
  ON vendor_categories_table
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage vendor categories table"
  ON vendor_categories_table
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Create function to update updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_vendor_categories_table_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_vendor_categories_table_updated_at'
  ) THEN
    CREATE TRIGGER update_vendor_categories_table_updated_at
    BEFORE UPDATE ON vendor_categories_table
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_categories_table_updated_at();
  END IF;
END
$$;

-- Create function to get vendor categories with vendor counts
CREATE OR REPLACE FUNCTION get_vendor_categories_with_vendors()
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
    vct.id,
    vct.name,
    vct.slug,
    vct.description,
    vct.image_url,
    COUNT(vc.vendor_id) AS vendor_count
  FROM 
    vendor_categories_table vct
    LEFT JOIN vendor_to_category vc ON vct.id = vc.category_id
  GROUP BY 
    vct.id, vct.name, vct.slug, vct.description, vct.image_url
  ORDER BY 
    vct.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get vendors by category
CREATE OR REPLACE FUNCTION get_vendors_by_category_table(
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
    vendor_to_category vc
    JOIN vendors v ON vc.vendor_id = v.id
  WHERE 
    vc.category_id = p_category_id
    AND v.status = 'active'
  ORDER BY 
    v.rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create junction table for vendors and categories if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_to_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES vendor_categories_table(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, category_id)
);

-- Enable RLS on junction table
ALTER TABLE vendor_to_category ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Vendor to category is viewable by everyone" ON vendor_to_category;
DROP POLICY IF EXISTS "Admins can manage vendor to category" ON vendor_to_category;

-- Create policies
CREATE POLICY "Vendor to category is viewable by everyone"
  ON vendor_to_category
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage vendor to category"
  ON vendor_to_category
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Insert sample data if table is empty
INSERT INTO vendor_categories_table (name, slug, description, image_url)
SELECT 
  'مطاعم',
  'restaurants',
  'أشهى المأكولات من أفضل المطاعم',
  'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1200'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_categories_table WHERE slug = 'restaurants'
);

INSERT INTO vendor_categories_table (name, slug, description, image_url)
SELECT 
  'سوبر ماركت',
  'supermarkets',
  'تسوق من أفضل الماركت في المدينة',
  'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1200'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_categories_table WHERE slug = 'supermarkets'
);

INSERT INTO vendor_categories_table (name, slug, description, image_url)
SELECT 
  'مقاهي',
  'cafes',
  'استمتع بأفضل المشروبات في أجواء مميزة',
  'https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=1200'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_categories_table WHERE slug = 'cafes'
);

INSERT INTO vendor_categories_table (name, slug, description, image_url)
SELECT 
  'حلويات',
  'desserts',
  'ألذ الحلويات والمعجنات الطازجة',
  'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=1200'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_categories_table WHERE slug = 'desserts'
);