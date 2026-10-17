/*
  # Add Sub-Areas Support

  1. Changes
    - Add parent_id column to service_areas table for hierarchical structure
    - Update sample data to use parent-child relationships
    - Add function to get areas with sub-areas

  2. Structure
    - Main areas (parent_id = NULL): القدس، رام الله، بيت لحم، الخليل، نابلس
    - Sub-areas (parent_id = parent area id): المركز، البلدة القديمة، etc.
*/

-- Add parent_id column to service_areas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_areas' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE service_areas ADD COLUMN parent_id uuid REFERENCES service_areas(id) ON DELETE CASCADE;
    CREATE INDEX idx_service_areas_parent ON service_areas(parent_id);
  END IF;
END $$;

-- Clear existing data
TRUNCATE service_areas CASCADE;

-- Insert main areas (cities)
INSERT INTO service_areas (id, name, city, delivery_price, is_active, parent_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'القدس', 'القدس', 10.00, true, NULL),
  ('22222222-2222-2222-2222-222222222222', 'رام الله', 'رام الله', 8.00, true, NULL),
  ('33333333-3333-3333-3333-333333333333', 'بيت لحم', 'بيت لحم', 8.00, true, NULL),
  ('44444444-4444-4444-4444-444444444444', 'الخليل', 'الخليل', 10.00, true, NULL),
  ('55555555-5555-5555-5555-555555555555', 'نابلس', 'نابلس', 8.00, true, NULL),
  ('66666666-6666-6666-6666-666666666666', 'جنين', 'جنين', 8.00, true, NULL),
  ('77777777-7777-7777-7777-777777777777', 'طولكرم', 'طولكرم', 8.00, true, NULL),
  ('88888888-8888-8888-8888-888888888888', 'قلقيلية', 'قلقيلية', 8.00, true, NULL);

-- Insert sub-areas for القدس
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'القدس', 10.00, true, '11111111-1111-1111-1111-111111111111'),
  ('البلدة القديمة', 'القدس', 15.00, true, '11111111-1111-1111-1111-111111111111'),
  ('الشيخ جراح', 'القدس', 12.00, true, '11111111-1111-1111-1111-111111111111'),
  ('سلوان', 'القدس', 12.00, true, '11111111-1111-1111-1111-111111111111'),
  ('بيت حنينا', 'القدس', 13.00, true, '11111111-1111-1111-1111-111111111111'),
  ('العيزرية', 'القدس', 14.00, true, '11111111-1111-1111-1111-111111111111');

-- Insert sub-areas for رام الله
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'رام الله', 8.00, true, '22222222-2222-2222-2222-222222222222'),
  ('البيرة', 'رام الله', 10.00, true, '22222222-2222-2222-2222-222222222222'),
  ('بيتونيا', 'رام الله', 10.00, true, '22222222-2222-2222-2222-222222222222'),
  ('الماصيون', 'رام الله', 12.00, true, '22222222-2222-2222-2222-222222222222');

-- Insert sub-areas for بيت لحم
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'بيت لحم', 8.00, true, '33333333-3333-3333-3333-333333333333'),
  ('بيت ساحور', 'بيت لحم', 10.00, true, '33333333-3333-3333-3333-333333333333'),
  ('بيت جالا', 'بيت لحم', 10.00, true, '33333333-3333-3333-3333-333333333333'),
  ('الدوحة', 'بيت لحم', 12.00, true, '33333333-3333-3333-3333-333333333333');

-- Insert sub-areas for الخليل
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'الخليل', 10.00, true, '44444444-4444-4444-4444-444444444444'),
  ('البلدة القديمة', 'الخليل', 12.00, true, '44444444-4444-4444-4444-444444444444'),
  ('دورا', 'الخليل', 13.00, true, '44444444-4444-4444-4444-444444444444'),
  ('يطا', 'الخليل', 15.00, true, '44444444-4444-4444-4444-444444444444');

-- Insert sub-areas for نابلس
INSERT INTO service_areas (name, city, delivery_price, is_active, parent_id) VALUES
  ('المركز', 'نابلس', 8.00, true, '55555555-5555-5555-5555-555555555555'),
  ('البلدة القديمة', 'نابلس', 10.00, true, '55555555-5555-5555-5555-555555555555'),
  ('رفيديا', 'نابلس', 9.00, true, '55555555-5555-5555-5555-555555555555'),
  ('عسكر', 'نابلس', 12.00, true, '55555555-5555-5555-5555-555555555555');

-- Create function to get all areas with hierarchy
CREATE OR REPLACE FUNCTION get_service_areas_hierarchy()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  delivery_price decimal,
  is_active boolean,
  parent_id uuid,
  parent_name text,
  level int
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE area_tree AS (
    -- Main areas (level 0)
    SELECT
      sa.id,
      sa.name,
      sa.city,
      sa.delivery_price,
      sa.is_active,
      sa.parent_id,
      NULL::text as parent_name,
      0 as level
    FROM service_areas sa
    WHERE sa.parent_id IS NULL

    UNION ALL

    -- Sub-areas (level 1+)
    SELECT
      sa.id,
      sa.name,
      sa.city,
      sa.delivery_price,
      sa.is_active,
      sa.parent_id,
      at.name as parent_name,
      at.level + 1
    FROM service_areas sa
    INNER JOIN area_tree at ON sa.parent_id = at.id
  )
  SELECT * FROM area_tree
  ORDER BY city, level, name;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_service_areas_hierarchy() TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_areas_hierarchy() TO anon;

-- Create function to get sub-areas for a parent
CREATE OR REPLACE FUNCTION get_sub_areas(p_parent_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  delivery_price decimal,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.name,
    sa.city,
    sa.delivery_price,
    sa.is_active
  FROM service_areas sa
  WHERE sa.parent_id = p_parent_id
  ORDER BY sa.name;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_sub_areas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sub_areas(uuid) TO anon;
