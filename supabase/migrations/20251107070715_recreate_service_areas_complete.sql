/*
  # إعادة إنشاء نظام مناطق الخدمة بالكامل
  
  حذف الجداول القديمة وإنشاء جداول جديدة مع البنية الهرمية الصحيحة
*/

-- حذف الجداول القديمة إن وجدت
DROP TABLE IF EXISTS vendor_service_areas CASCADE;
DROP TABLE IF EXISTS service_areas CASCADE;

-- إنشاء جدول مناطق الخدمة
CREATE TABLE service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  coordinates jsonb DEFAULT '[]'::jsonb,
  delivery_price decimal(10, 2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  parent_id uuid REFERENCES service_areas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء جدول ربط البائعين بمناطق الخدمة
CREATE TABLE vendor_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  custom_delivery_price decimal(10, 2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, service_area_id)
);

-- إنشاء الفهارس
CREATE INDEX idx_service_areas_city ON service_areas(city);
CREATE INDEX idx_service_areas_is_active ON service_areas(is_active);
CREATE INDEX idx_service_areas_parent ON service_areas(parent_id);
CREATE INDEX idx_vendor_service_areas_vendor ON vendor_service_areas(vendor_id);
CREATE INDEX idx_vendor_service_areas_area ON vendor_service_areas(service_area_id);

-- تفعيل RLS
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_service_areas ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجدول service_areas
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

-- سياسات الأمان لجدول vendor_service_areas
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

-- دالة لتحديث updated_at
CREATE OR REPLACE FUNCTION update_service_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_service_areas_updated_at();

-- دالة للحصول على مناطق البائع مع الأسعار
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

GRANT EXECUTE ON FUNCTION get_vendor_service_areas_with_prices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_service_areas_with_prices(uuid) TO anon;

-- إدراج المناطق الرئيسية (المدن)
INSERT INTO service_areas (id, name, city, delivery_price, is_active, parent_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'القدس', 'القدس', 10.00, true, NULL),
  ('22222222-2222-2222-2222-222222222222', 'رام الله', 'رام الله', 8.00, true, NULL),
  ('33333333-3333-3333-3333-333333333333', 'بيت لحم', 'بيت لحم', 8.00, true, NULL),
  ('44444444-4444-4444-4444-444444444444', 'الخليل', 'الخليل', 10.00, true, NULL),
  ('55555555-5555-5555-5555-555555555555', 'نابلس', 'نابلس', 8.00, true, NULL),
  ('66666666-6666-6666-6666-666666666666', 'جنين', 'جنين', 8.00, true, NULL),
  ('77777777-7777-7777-7777-777777777777', 'طولكرم', 'طولكرم', 8.00, true, NULL),
  ('88888888-8888-8888-8888-888888888888', 'قلقيلية', 'قلقيلية', 8.00, true, NULL);

-- إدراج المناطق الفرعية للقدس
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'القدس', 10.00, true, '11111111-1111-1111-1111-111111111111'),
  ('البلدة القديمة', 'القدس', 15.00, true, '11111111-1111-1111-1111-111111111111'),
  ('الشيخ جراح', 'القدس', 12.00, true, '11111111-1111-1111-1111-111111111111'),
  ('سلوان', 'القدس', 12.00, true, '11111111-1111-1111-1111-111111111111'),
  ('بيت حنينا', 'القدس', 13.00, true, '11111111-1111-1111-1111-111111111111'),
  ('العيزرية', 'القدس', 14.00, true, '11111111-1111-1111-1111-111111111111');

-- إدراج المناطق الفرعية لرام الله
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'رام الله', 8.00, true, '22222222-2222-2222-2222-222222222222'),
  ('البيرة', 'رام الله', 10.00, true, '22222222-2222-2222-2222-222222222222'),
  ('بيتونيا', 'رام الله', 10.00, true, '22222222-2222-2222-2222-222222222222'),
  ('الماصيون', 'رام الله', 12.00, true, '22222222-2222-2222-2222-222222222222');

-- إدراج المناطق الفرعية لبيت لحم
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'بيت لحم', 8.00, true, '33333333-3333-3333-3333-333333333333'),
  ('بيت ساحور', 'بيت لحم', 10.00, true, '33333333-3333-3333-3333-333333333333'),
  ('بيت جالا', 'بيت لحم', 10.00, true, '33333333-3333-3333-3333-333333333333'),
  ('الدوحة', 'بيت لحم', 12.00, true, '33333333-3333-3333-3333-333333333333');

-- إدراج المناطق الفرعية للخليل
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'الخليل', 10.00, true, '44444444-4444-4444-4444-444444444444'),
  ('البلدة القديمة', 'الخليل', 12.00, true, '44444444-4444-4444-4444-444444444444'),
  ('دورا', 'الخليل', 13.00, true, '44444444-4444-4444-4444-444444444444'),
  ('يطا', 'الخليل', 15.00, true, '44444444-4444-4444-4444-444444444444');

-- إدراج المناطق الفرعية لنابلس
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'نابلس', 8.00, true, '55555555-5555-5555-5555-555555555555'),
  ('البلدة القديمة', 'نابلس', 10.00, true, '55555555-5555-5555-5555-555555555555'),
  ('رفيديا', 'نابلس', 9.00, true, '55555555-5555-5555-5555-555555555555'),
  ('عسكر', 'نابلس', 12.00, true, '55555555-5555-5555-5555-555555555555');