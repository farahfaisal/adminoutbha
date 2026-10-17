/*
  # Create Service Areas Table

  1. New Tables
    - `service_areas`
      - `id` (uuid, primary key)
      - `name` (text) - اسم المنطقة
      - `city` (text) - المدينة
      - `coordinates` (jsonb) - إحداثيات حدود المنطقة
      - `delivery_price` (decimal) - سعر التوصيل لهذه المنطقة
      - `is_active` (boolean) - حالة المنطقة
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `vendor_service_areas`
      - `id` (uuid, primary key)
      - `vendor_id` (uuid, foreign key)
      - `service_area_id` (uuid, foreign key)
      - `custom_delivery_price` (decimal) - سعر توصيل مخصص للبائع (اختياري)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Allow public to read active service areas
    - Allow authenticated users to manage vendor service areas
*/

-- Create service_areas table
CREATE TABLE IF NOT EXISTS service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  coordinates jsonb DEFAULT '[]'::jsonb,
  delivery_price decimal(10, 2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create vendor_service_areas junction table
CREATE TABLE IF NOT EXISTS vendor_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  custom_delivery_price decimal(10, 2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, service_area_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_areas_city ON service_areas(city);
CREATE INDEX IF NOT EXISTS idx_service_areas_is_active ON service_areas(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_service_areas_vendor ON vendor_service_areas(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_service_areas_area ON vendor_service_areas(service_area_id);

-- Enable RLS
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_service_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_areas
CREATE POLICY "Anyone can view active service areas"
  ON service_areas FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all service areas"
  ON service_areas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert service areas"
  ON service_areas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update service areas"
  ON service_areas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete service areas"
  ON service_areas FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for vendor_service_areas
CREATE POLICY "Anyone can view vendor service areas"
  ON vendor_service_areas FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert vendor service areas"
  ON vendor_service_areas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendor service areas"
  ON vendor_service_areas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vendor service areas"
  ON vendor_service_areas FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS service_areas_updated_at ON service_areas;
CREATE TRIGGER service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_service_areas_updated_at();

-- Create helper function to get vendor service areas with prices
CREATE OR REPLACE FUNCTION get_vendor_service_areas_with_prices(p_vendor_id uuid)
RETURNS TABLE (
  area_id uuid,
  area_name text,
  city text,
  coordinates jsonb,
  delivery_price decimal,
  custom_price decimal,
  final_price decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.name,
    sa.city,
    sa.coordinates,
    sa.delivery_price,
    vsa.custom_delivery_price,
    COALESCE(vsa.custom_delivery_price, sa.delivery_price) as final_price
  FROM service_areas sa
  INNER JOIN vendor_service_areas vsa ON sa.id = vsa.service_area_id
  WHERE vsa.vendor_id = p_vendor_id
    AND sa.is_active = true
  ORDER BY sa.city, sa.name;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_vendor_service_areas_with_prices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_service_areas_with_prices(uuid) TO anon;

-- Insert some sample service areas
INSERT INTO service_areas (name, city, delivery_price, coordinates) VALUES
  ('المركز', 'القدس', 10.00, '[]'::jsonb),
  ('البلدة القديمة', 'القدس', 15.00, '[]'::jsonb),
  ('الشيخ جراح', 'القدس', 12.00, '[]'::jsonb),
  ('سلوان', 'القدس', 12.00, '[]'::jsonb),
  ('المركز', 'رام الله', 8.00, '[]'::jsonb),
  ('البيرة', 'رام الله', 10.00, '[]'::jsonb),
  ('المركز', 'بيت لحم', 8.00, '[]'::jsonb),
  ('بيت ساحور', 'بيت لحم', 10.00, '[]'::jsonb),
  ('المركز', 'الخليل', 10.00, '[]'::jsonb),
  ('البلدة القديمة', 'الخليل', 12.00, '[]'::jsonb),
  ('المركز', 'نابلس', 8.00, '[]'::jsonb),
  ('البلدة القديمة', 'نابلس', 10.00, '[]'::jsonb),
  ('المركز', 'جنين', 8.00, '[]'::jsonb),
  ('المركز', 'طولكرم', 8.00, '[]'::jsonb),
  ('المركز', 'قلقيلية', 8.00, '[]'::jsonb)
ON CONFLICT DO NOTHING;
