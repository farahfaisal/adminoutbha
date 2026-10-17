/*
# Align financial summary fields with the financial dashboard

1. Purpose
- The financial dashboard reads named fields such as `total_sales`, `admin_commissions`, and payment-method totals.
- The previous RPC returned different names (`total_revenue`, `total_orders`), so the screen silently displayed zero values even when data existed.

2. Modified objects
- Replaces `public.get_financial_summary()` with a dashboard-compatible JSON response.
- Calculates total sales from `orders.total`.
- Splits sales by `orders.payment_method` into electronic and cash totals.
- Calculates the displayed commission and vendor/driver balance estimates using the application's existing 15% / 70% / 30% distribution.
- Retains the general order, customer, vendor, driver, and product counts.

3. Security
- The function remains `SECURITY DEFINER` with a fixed `public` search path.
- Execution remains available to the dashboard's anon and authenticated clients.

4. Important notes
- No rows are deleted or modified.
- Empty datasets return numeric zero values instead of null values.
*/

CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sales numeric := 0;
  v_electronic_payments numeric := 0;
  v_cash_payments numeric := 0;
  v_total_orders integer := 0;
  v_total_pending integer := 0;
  v_total_completed integer := 0;
  v_total_customers integer := 0;
  v_total_vendors integer := 0;
  v_total_drivers integer := 0;
  v_total_products integer := 0;
  v_admin_commissions numeric := 0;
  v_vendor_balances numeric := 0;
  v_driver_balances numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(total, 0)), 0),
    COALESCE(SUM(CASE WHEN lower(COALESCE(payment_method, '')) IN ('electronic', 'card', 'online', 'credit_card') THEN COALESCE(total, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN lower(COALESCE(payment_method, '')) IN ('cash', 'cod') OR payment_method IS NULL OR lower(payment_method) NOT IN ('electronic', 'card', 'online', 'credit_card') THEN COALESCE(total, 0) ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_sales, v_electronic_payments, v_cash_payments, v_total_orders
  FROM public.orders;

  v_admin_commissions := v_total_sales * 0.15;
  v_vendor_balances := v_total_sales * 0.70;
  v_driver_balances := v_total_sales * 0.30;

  SELECT COUNT(*) INTO v_total_pending FROM public.orders WHERE status IN ('pending', 'processing', 'accepted', 'ready', 'delivering');
  SELECT COUNT(*) INTO v_total_completed FROM public.orders WHERE status = 'completed';
  SELECT COUNT(*) INTO v_total_customers FROM public.customers;
  SELECT COUNT(*) INTO v_total_vendors FROM public.vendors;
  SELECT COUNT(*) INTO v_total_drivers FROM public.drivers;
  SELECT COUNT(*) INTO v_total_products FROM public.products;

  RETURN jsonb_build_object(
    'total_sales', v_total_sales,
    'electronic_payments', v_electronic_payments,
    'cash_payments', v_cash_payments,
    'admin_commissions', v_admin_commissions,
    'admin_commissions_vendors', v_vendor_balances * 0.15 / 0.15,
    'admin_commissions_drivers', v_driver_balances * 0.15 / 0.30,
    'admin_commissions_electronic', v_electronic_payments * 0.15,
    'admin_commissions_cash', v_cash_payments * 0.15,
    'pending_commissions_vendors', 0,
    'pending_commissions_drivers', 0,
    'vendor_balances', v_vendor_balances,
    'vendor_available_balances', v_vendor_balances,
    'vendor_pending_balances', 0,
    'vendor_balances_electronic', v_electronic_payments * 0.70,
    'vendor_balances_cash', v_cash_payments * 0.70,
    'driver_balances', v_driver_balances,
    'driver_available_balances', v_driver_balances,
    'driver_pending_balances', 0,
    'driver_balances_electronic', v_electronic_payments * 0.30,
    'driver_balances_cash', v_cash_payments * 0.30,
    'total_revenue', v_total_sales,
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
