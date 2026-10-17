-- Create get_dashboard_stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'totalOrders', (SELECT COUNT(*) FROM orders),
    'totalRevenue', COALESCE((SELECT SUM(total) FROM orders), 0),
    'totalCustomers', (SELECT COUNT(*) FROM customers),
    'totalVendors', (SELECT COUNT(*) FROM vendors),
    'totalDrivers', (SELECT COUNT(*) FROM drivers),
    'totalProducts', (SELECT COUNT(*) FROM products),
    'averageOrderValue', CASE
      WHEN (SELECT COUNT(*) FROM orders) > 0
      THEN COALESCE((SELECT SUM(total) FROM orders), 0) / (SELECT COUNT(*) FROM orders)
      ELSE 0
    END,
    'completionRate', CASE
      WHEN (SELECT COUNT(*) FROM orders) > 0
      THEN (SELECT COUNT(*) FROM orders WHERE status = 'completed')::numeric * 100 / (SELECT COUNT(*) FROM orders)
      ELSE 0
    END
  );
$$;

-- Create get_vendor_status_stats function
CREATE OR REPLACE FUNCTION public.get_vendor_status_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'active', (SELECT COUNT(*) FROM vendors WHERE status = 'active'),
    'inactive', (SELECT COUNT(*) FROM vendors WHERE status = 'inactive'),
    'busy', (SELECT COUNT(*) FROM vendors WHERE status = 'busy'),
    'suspended', (SELECT COUNT(*) FROM vendors WHERE status = 'suspended'),
    'pending', (SELECT COUNT(*) FROM vendors WHERE status = 'pending')
  );
$$;

-- Create get_top_vendors function
CREATE OR REPLACE FUNCTION public.get_top_vendors(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  store_name TEXT,
  total_orders BIGINT,
  total_revenue NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.store_name,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total), 0) AS total_revenue
  FROM vendors v
  LEFT JOIN orders o ON o.vendor_id = v.id
  GROUP BY v.id, v.store_name
  ORDER BY total_revenue DESC
  LIMIT limit_count;
$$;

-- Grant access to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_status_stats() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_top_vendors(INTEGER) TO authenticated, anon;