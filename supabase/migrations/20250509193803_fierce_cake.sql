/*
  # Add Points Customers Function

  1. Changes
    - Add function to get customers with points
    - This function is needed for the points-rewards page
*/

-- Create function to get customers with points
CREATE OR REPLACE FUNCTION get_customers_with_points()
RETURNS TABLE (
  id uuid,
  customer_id uuid,
  name text,
  email text,
  phone text,
  balance integer,
  total_earned integer,
  total_spent integer,
  last_activity timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.id,
    pa.customer_id,
    c.name,
    c.email,
    c.phone,
    pa.balance,
    pa.total_earned,
    pa.total_spent,
    pa.last_activity
  FROM points_accounts pa
  JOIN customers c ON pa.customer_id = c.id
  ORDER BY pa.balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;