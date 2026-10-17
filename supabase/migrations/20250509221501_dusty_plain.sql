/*
  # Fix Customers Query Issue

  1. Changes
    - Add function to get all customers without relationship issues
    - This function uses a direct SQL query to avoid the "more than one relationship" error
*/

-- Create function to get all customers
CREATE OR REPLACE FUNCTION get_all_customers()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  phone text,
  email text,
  address text,
  notes text,
  rating decimal(3,2),
  rating_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  wholesale_info jsonb,
  orders_count bigint,
  total_spent numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.phone,
    c.email,
    c.address,
    c.notes,
    c.rating,
    c.rating_count,
    c.created_at,
    c.updated_at,
    c.wholesale_info,
    COUNT(o.id) AS orders_count,
    COALESCE(SUM(o.total), 0) AS total_spent
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id
  GROUP BY c.id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;