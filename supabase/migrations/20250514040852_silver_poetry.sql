/*
  # Fix Ratings Policies and Functions

  1. Updates
    - Fixes the policy for ratings table
    - Recreates functions for ratings management
    - Ensures proper trigger setup for rating updates
  
  2. Changes
    - Drops and recreates policies with proper syntax
    - Updates the rating average calculation function
    - Fixes trigger for updating entity ratings
*/

-- Create ratings table if it doesn't exist
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES ord(id),
  from_type TEXT NOT NULL,
  from_id UUID NOT NULL,
  to_type TEXT NOT NULL,
  to_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ratings_from_type_check CHECK (from_type IN ('customer', 'vendor', 'driver')),
  CONSTRAINT ratings_to_type_check CHECK (to_type IN ('customer', 'vendor', 'driver')),
  CONSTRAINT ratings_rating_check CHECK (rating >= 1 AND rating <= 5)
);

-- Enable RLS if not already enabled
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON ratings;

-- Create policies with proper syntax
CREATE POLICY "Ratings are viewable by everyone"
  ON ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- For INSERT policy, use WITH CHECK instead of USING for INSERT operations
CREATE POLICY "Users can create ratings"
  ON ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to get ratings by type
CREATE OR REPLACE FUNCTION get_ratings_by_type(p_type TEXT, p_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  from_type TEXT,
  from_id UUID,
  from_name TEXT,
  to_type TEXT,
  to_id UUID,
  to_name TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.order_id,
    r.from_type,
    r.from_id,
    CASE 
      WHEN r.from_type = 'customer' THEN (SELECT name FROM customers WHERE id = r.from_id)
      WHEN r.from_type = 'vendor' THEN (SELECT store_name FROM vendors WHERE id = r.from_id)
      WHEN r.from_type = 'driver' THEN (SELECT name FROM drivers WHERE id = r.from_id)
      ELSE 'Unknown'
    END as from_name,
    r.to_type,
    r.to_id,
    CASE 
      WHEN r.to_type = 'customer' THEN (SELECT name FROM customers WHERE id = r.to_id)
      WHEN r.to_type = 'vendor' THEN (SELECT store_name FROM vendors WHERE id = r.to_id)
      WHEN r.to_type = 'driver' THEN (SELECT name FROM drivers WHERE id = r.to_id)
      ELSE 'Unknown'
    END as to_name,
    r.rating,
    r.comment,
    r.created_at
  FROM 
    ratings r
  WHERE 
    (r.to_type = p_type) AND
    (p_id IS NULL OR r.to_id = p_id)
  ORDER BY 
    r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get ratings statistics
CREATE OR REPLACE FUNCTION get_ratings_stats(p_type TEXT, p_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
  v_distribution JSON;
BEGIN
  -- Get average rating
  SELECT 
    AVG(rating)::NUMERIC(3,2), 
    COUNT(*)
  INTO 
    v_avg, 
    v_count
  FROM 
    ratings
  WHERE 
    to_type = p_type AND
    (p_id IS NULL OR to_id = p_id);
  
  -- Get distribution
  SELECT 
    json_object_agg(
      rating,
      (SELECT COUNT(*) FROM ratings WHERE to_type = p_type AND (p_id IS NULL OR to_id = p_id) AND rating = r.rating)
    )
  INTO 
    v_distribution
  FROM 
    (SELECT DISTINCT rating FROM ratings WHERE to_type = p_type AND (p_id IS NULL OR to_id = p_id)) r;
  
  -- Return stats
  RETURN json_build_object(
    'average', COALESCE(v_avg, 0),
    'total', v_count,
    'distribution', COALESCE(v_distribution, '{}'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get ratings report by month
CREATE OR REPLACE FUNCTION get_ratings_report(p_type TEXT, p_year INTEGER)
RETURNS TABLE (
  month INTEGER,
  avg_rating NUMERIC(3,2),
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM created_at)::INTEGER AS month,
    COALESCE(AVG(rating), 0)::NUMERIC(3,2) AS avg_rating,
    COUNT(*) AS count
  FROM 
    ratings
  WHERE 
    to_type = p_type AND
    EXTRACT(YEAR FROM created_at) = p_year
  GROUP BY 
    month
  ORDER BY 
    month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace trigger function to update entity rating average
CREATE OR REPLACE FUNCTION update_rating_average()
RETURNS TRIGGER AS $$
BEGIN
  -- Update vendor rating
  IF NEW.to_type = 'vendor' THEN
    UPDATE vendors
    SET 
      rating = (SELECT COALESCE(AVG(rating), 5)::NUMERIC(3,2) FROM ratings WHERE to_type = 'vendor' AND to_id = NEW.to_id),
      rating_count = (SELECT COUNT(*) FROM ratings WHERE to_type = 'vendor' AND to_id = NEW.to_id)
    WHERE id = NEW.to_id;
  
  -- Update driver rating
  ELSIF NEW.to_type = 'driver' THEN
    UPDATE drivers
    SET 
      rating = (SELECT COALESCE(AVG(rating), 5)::NUMERIC(3,2) FROM ratings WHERE to_type = 'driver' AND to_id = NEW.to_id),
      rating_count = (SELECT COUNT(*) FROM ratings WHERE to_type = 'driver' AND to_id = NEW.to_id)
    WHERE id = NEW.to_id;
  
  -- Update customer rating
  ELSIF NEW.to_type = 'customer' THEN
    UPDATE customers
    SET 
      rating = (SELECT COALESCE(AVG(rating), 5)::NUMERIC(3,2) FROM ratings WHERE to_type = 'customer' AND to_id = NEW.to_id),
      rating_count = (SELECT COUNT(*) FROM ratings WHERE to_type = 'customer' AND to_id = NEW.to_id)
    WHERE id = NEW.to_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_rating_after_insert ON ratings;

-- Create trigger to update rating average after insert
CREATE TRIGGER update_rating_after_insert
AFTER INSERT ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_rating_average();