/*
  # Create Shared Product Catalogs System

  1. New Tables
    - `product_catalogs`
      - `id` (uuid, primary key)
      - `name` (text) - اسم القائمة (مثل: مشروبات، حلويات)
      - `name_en` (text) - الاسم بالإنجليزية
      - `description` (text) - وصف القائمة
      - `icon` (text) - أيقونة القائمة
      - `is_active` (boolean) - حالة التفعيل
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `catalog_items`
      - `id` (uuid, primary key)
      - `catalog_id` (uuid, foreign key)
      - `name` (text) - اسم المنتج
      - `name_en` (text) - الاسم بالإنجليزية
      - `description` (text) - وصف المنتج
      - `default_price` (numeric) - السعر الافتراضي
      - `image_url` (text) - صورة المنتج
      - `unit` (text) - وحدة القياس (حبة، كيلو، لتر)
      - `variants` (jsonb) - الأحجام/الأنواع المتاحة
      - `addons` (jsonb) - الإضافات المتاحة
      - `is_active` (boolean) - حالة التفعيل
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Admins can manage catalogs
    - Vendors can view active catalogs
    - Vendors can import items to their products
*/

-- Create product_catalogs table
CREATE TABLE IF NOT EXISTS product_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create catalog_items table
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES product_catalogs(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  description text,
  default_price numeric DEFAULT 0,
  image_url text,
  unit text DEFAULT 'حبة',
  variants jsonb DEFAULT '[]'::jsonb,
  addons jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_catalog_items_catalog_id ON catalog_items(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalogs_active ON product_catalogs(is_active);

-- Enable RLS
ALTER TABLE product_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Policies for product_catalogs

-- Admins can do everything
CREATE POLICY "Admins can manage catalogs"
  ON product_catalogs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Vendors can view active catalogs
CREATE POLICY "Vendors can view active catalogs"
  ON product_catalogs
  FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = auth.uid()
    )
  );

-- Policies for catalog_items

-- Admins can manage catalog items
CREATE POLICY "Admins can manage catalog items"
  ON catalog_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Vendors can view active catalog items
CREATE POLICY "Vendors can view active catalog items"
  ON catalog_items
  FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM product_catalogs
      WHERE product_catalogs.id = catalog_items.catalog_id
      AND product_catalogs.is_active = true
    ) AND
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = auth.uid()
    )
  );

-- Insert some default catalogs
INSERT INTO product_catalogs (name, name_en, description, icon, is_active) VALUES
  ('مشروبات', 'Beverages', 'مشروبات غازية وعصائر ومياه', '🥤', true),
  ('حلويات', 'Sweets', 'حلويات ومعجنات وكعك', '🍰', true),
  ('وجبات سريعة', 'Fast Food', 'برجر، بيتزا، ساندويتشات', '🍔', true),
  ('منتجات ألبان', 'Dairy Products', 'حليب، لبن، جبن، زبدة', '🥛', true),
  ('مخبوزات', 'Bakery', 'خبز، كعك، معجنات', '🥖', true)
ON CONFLICT DO NOTHING;

-- Insert some sample items for beverages catalog
DO $$
DECLARE
  beverages_id uuid;
BEGIN
  SELECT id INTO beverages_id FROM product_catalogs WHERE name_en = 'Beverages' LIMIT 1;
  
  IF beverages_id IS NOT NULL THEN
    INSERT INTO catalog_items (catalog_id, name, name_en, description, default_price, unit, variants) VALUES
      (beverages_id, 'كوكاكولا', 'Coca Cola', 'مشروب غازي', 3, 'حبة', '[{"name": "صغير 250مل", "price": 3}, {"name": "وسط 500مل", "price": 5}, {"name": "كبير 1 لتر", "price": 8}]'::jsonb),
      (beverages_id, 'بيبسي', 'Pepsi', 'مشروب غازي', 3, 'حبة', '[{"name": "صغير 250مل", "price": 3}, {"name": "وسط 500مل", "price": 5}, {"name": "كبير 1 لتر", "price": 8}]'::jsonb),
      (beverages_id, 'سفن أب', '7Up', 'مشروب غازي', 3, 'حبة', '[{"name": "صغير 250مل", "price": 3}, {"name": "وسط 500مل", "price": 5}]'::jsonb),
      (beverages_id, 'ميرندا برتقال', 'Mirinda Orange', 'مشروب غازي بنكهة البرتقال', 3, 'حبة', '[{"name": "صغير 250مل", "price": 3}, {"name": "وسط 500مل", "price": 5}]'::jsonb),
      (beverages_id, 'ماء', 'Water', 'مياه معدنية', 2, 'حبة', '[{"name": "صغير 500مل", "price": 2}, {"name": "كبير 1.5 لتر", "price": 4}]'::jsonb),
      (beverages_id, 'عصير برتقال', 'Orange Juice', 'عصير برتقال طبيعي', 8, 'كأس', '[{"name": "صغير 250مل", "price": 8}, {"name": "كبير 500مل", "price": 12}]'::jsonb),
      (beverages_id, 'عصير تفاح', 'Apple Juice', 'عصير تفاح طبيعي', 8, 'كأس', '[{"name": "صغير 250مل", "price": 8}, {"name": "كبير 500مل", "price": 12}]'::jsonb)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
