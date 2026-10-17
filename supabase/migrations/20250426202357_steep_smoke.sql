/*
  # Add Ratings Functions

  1. New Functions
    - `get_ratings_by_type` - Function to get ratings by type
    - `get_ratings_stats` - Function to get ratings statistics
*/

-- Create or replace function to get ratings by type
CREATE OR REPLACE FUNCTION get_ratings_by_type(p_type text, p_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  from_type text,
  from_id uuid,
  from_name text,
  to_type text,
  to_id uuid,
  to_name text,
  rating int,
  comment text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.order_id,
    r.from_type,
    r.from_id,
    CASE 
      WHEN r.from_type = 'customer' THEN c.name
      WHEN r.from_type = 'vendor' THEN v.store_name
      WHEN r.from_type = 'driver' THEN d.name
      ELSE 'Unknown'
    END as from_name,
    r.to_type,
    r.to_id,
    CASE 
      WHEN r.to_type = 'customer' THEN c2.name
      WHEN r.to_type = 'vendor' THEN v2.store_name
      WHEN r.to_type = 'driver' THEN d2.name
      ELSE 'Unknown'
    END as to_name,
    r.rating,
    r.comment,
    r.created_at
  FROM ratings r
  LEFT JOIN customers c ON r.from_type = 'customer' AND r.from_id = c.id
  LEFT JOIN vendors v ON r.from_type = 'vendor' AND r.from_id = v.id
  LEFT JOIN drivers d ON r.from_type = 'driver' AND r.from_id = d.id
  LEFT JOIN customers c2 ON r.to_type = 'customer' AND r.to_id = c2.id
  LEFT JOIN vendors v2 ON r.to_type = 'vendor' AND r.to_id = v2.id
  LEFT JOIN drivers d2 ON r.to_type = 'driver' AND r.to_id = d2.id
  WHERE r.to_type = p_type
  AND (p_id IS NULL OR r.to_id = p_id)
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to get ratings statistics
CREATE OR REPLACE FUNCTION get_ratings_stats(p_type text, p_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_avg_rating decimal(3,2);
  v_total int;
  v_distribution jsonb;
  v_result jsonb;
BEGIN
  -- Get average rating and total count
  SELECT 
    COALESCE(AVG(rating), 0)::decimal(3,2),
    COUNT(*)
  INTO v_avg_rating, v_total
  FROM ratings
  WHERE to_type = p_type
  AND (p_id IS NULL OR to_id = p_id);
  
  -- Get distribution
  SELECT jsonb_build_object(
    '5', COUNT(*) FILTER (WHERE rating = 5),
    '4', COUNT(*) FILTER (WHERE rating = 4),
    '3', COUNT(*) FILTER (WHERE rating = 3),
    '2', COUNT(*) FILTER (WHERE rating = 2),
    '1', COUNT(*) FILTER (WHERE rating = 1)
  ) INTO v_distribution
  FROM ratings
  WHERE to_type = p_type
  AND (p_id IS NULL OR to_id = p_id);
  
  -- Build result
  v_result := jsonb_build_object(
    'average', v_avg_rating,
    'total', v_total,
    'distribution', v_distribution
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;