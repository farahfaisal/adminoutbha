/*
# Fix orders, payment_methods, and get_financial_summary for dashboard

1. Purpose
- Add missing columns to `orders` (driver_id, driver_name) so the orders query with driver join succeeds.
- Add missing `status` column to `payment_methods` so the wallet/payment methods query succeeds.
- Create the `get_financial_summary` RPC function used by the financial dashboard.

2. Modified objects
- ALTER TABLE orders: add driver_id uuid, driver_name text.
- ALTER TABLE payment_methods: add status text default 'active'.
- CREATE FUNCTION get_financial_summary(): returns jsonb with total_revenue, total_orders, total_pending, total_completed, total_customers, total_vendors, total_drivers, total_products.

3. Security
- get_financial_summary is SECURITY DEFINER so it can read all tables regardless of RLS.
- Execution granted to anon and authenticated.
*/

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric := 0;
  v_total_orders integer := 0;
  v_total_pending integer := 0;
  v_total_completed integer := 0;
  v_total_customers integer := 0;
  v_total_vendors integer := 0;
  v_total_drivers integer := 0;
  v_total_products integer := 0;
BEGIN
  SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_total_revenue, v_total_orders FROM public.orders;
  SELECT COUNT(*) INTO v_total_pending FROM public.orders WHERE status IN ('pending', 'processing', 'accepted', 'ready', 'delivering');
  SELECT COUNT(*) INTO v_total_completed FROM public.orders WHERE status = 'completed';
  SELECT COUNT(*) INTO v_total_customers FROM public.customers;
  SELECT COUNT(*) INTO v_total_vendors FROM public.vendors;
  SELECT COUNT(*) INTO v_total_drivers FROM public.drivers;
  SELECT COUNT(*) INTO v_total_products FROM public.products;

  RETURN jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'total_pending', v_total_pending,
    'total_completed', v_total_completed,
    'total_customers', v_total_customers,
    'total_vendors', v_total_vendors,
    'total_drivers', v_total_drivers,
    'total_products', v_total_products
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO anon, authenticated;
