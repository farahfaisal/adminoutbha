/*
  # Fix Ratings Auto-Update System

  ## Problem
  - Ratings exist in the `ratings` table but are not reflected in `customers`, `vendors`, and `drivers` tables
  - The `rating` and `rating_count` fields remain at default values (5.00 and 0)
  
  ## Solution
  1. Create a function to update ratings for any entity (customer, vendor, driver)
  2. Create a trigger that runs after INSERT, UPDATE, or DELETE on ratings table
  3. Recalculate all existing ratings to fix current data

  ## Changes
  - Creates `update_entity_rating()` function
  - Creates `trigger_update_entity_rating` trigger on ratings table
  - Updates all existing ratings data
*/

-- Function to update rating for any entity
CREATE OR REPLACE FUNCTION update_entity_rating()
RETURNS TRIGGER AS $$
DECLARE
  entity_table TEXT;
  avg_rating NUMERIC;
  total_count INTEGER;
BEGIN
  -- Determine which operation and get the entity info
  IF (TG_OP = 'DELETE') THEN
    entity_table := OLD.to_type || 's';
    
    -- Calculate new rating
    SELECT 
      COALESCE(AVG(rating), 5.0),
      COALESCE(COUNT(*), 0)
    INTO avg_rating, total_count
    FROM ratings
    WHERE to_id = OLD.to_id AND to_type = OLD.to_type;
    
    -- Update the entity table
    EXECUTE format(
      'UPDATE %I SET rating = $1, rating_count = $2 WHERE id = $3',
      entity_table
    ) USING avg_rating, total_count, OLD.to_id;
    
    RETURN OLD;
  ELSE
    entity_table := NEW.to_type || 's';
    
    -- Calculate new rating
    SELECT 
      COALESCE(AVG(rating), 5.0),
      COALESCE(COUNT(*), 0)
    INTO avg_rating, total_count
    FROM ratings
    WHERE to_id = NEW.to_id AND to_type = NEW.to_type;
    
    -- Update the entity table
    EXECUTE format(
      'UPDATE %I SET rating = $1, rating_count = $2 WHERE id = $3',
      entity_table
    ) USING avg_rating, total_count, NEW.to_id;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_entity_rating ON ratings;

-- Create trigger
CREATE TRIGGER trigger_update_entity_rating
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_rating();

-- Recalculate all existing ratings for vendors
UPDATE vendors v
SET 
  rating = COALESCE(r.avg_rating, 5.0),
  rating_count = COALESCE(r.count, 0)
FROM (
  SELECT 
    to_id,
    AVG(rating) as avg_rating,
    COUNT(*) as count
  FROM ratings
  WHERE to_type = 'vendor'
  GROUP BY to_id
) r
WHERE v.id = r.to_id;

-- Recalculate all existing ratings for drivers
UPDATE drivers d
SET 
  rating = COALESCE(r.avg_rating, 5.0),
  rating_count = COALESCE(r.count, 0)
FROM (
  SELECT 
    to_id,
    AVG(rating) as avg_rating,
    COUNT(*) as count
  FROM ratings
  WHERE to_type = 'driver'
  GROUP BY to_id
) r
WHERE d.id = r.to_id;

-- Recalculate all existing ratings for customers
UPDATE customers c
SET 
  rating = COALESCE(r.avg_rating, 5.0),
  rating_count = COALESCE(r.count, 0)
FROM (
  SELECT 
    to_id,
    AVG(rating) as avg_rating,
    COUNT(*) as count
  FROM ratings
  WHERE to_type = 'customer'
  GROUP BY to_id
) r
WHERE c.id = r.to_id;
