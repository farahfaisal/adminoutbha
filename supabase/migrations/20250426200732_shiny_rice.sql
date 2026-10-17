/*
  # Add Financial Summary Function

  1. New Functions
    - `get_financial_summary` - Function to get financial summary data
    - This function calculates total sales, commissions, and balances
*/

-- Create or replace function to get financial summary
CREATE OR REPLACE FUNCTION get_financial_summary()
RETURNS jsonb AS $$
DECLARE
  v_total_sales decimal;
  v_electronic_payments decimal;
  v_cash_payments decimal;
  v_admin_commissions decimal;
  v_admin_commissions_vendors decimal;
  v_admin_commissions_drivers decimal;
  v_vendor_balances decimal;
  v_driver_balances decimal;
  v_result jsonb;
BEGIN
  -- Get total sales
  SELECT COALESCE(SUM(total), 0) INTO v_total_sales FROM orders;
  
  -- Get electronic payments
  SELECT COALESCE(SUM(total), 0) INTO v_electronic_payments 
  FROM orders 
  WHERE payment_method = 'electronic';
  
  -- Get cash payments
  SELECT COALESCE(SUM(total), 0) INTO v_cash_payments 
  FROM orders 
  WHERE payment_method = 'cash';
  
  -- Get admin commissions
  SELECT COALESCE(SUM(amount), 0) INTO v_admin_commissions 
  FROM wallet_transactions 
  WHERE payment_type = 'commission';
  
  -- Get admin commissions from vendors
  SELECT COALESCE(SUM(amount), 0) INTO v_admin_commissions_vendors 
  FROM wallet_transactions 
  WHERE payment_type = 'commission'
  AND EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND w.user_id IN (SELECT user_id FROM vendors)
  );
  
  -- Get admin commissions from drivers
  SELECT COALESCE(SUM(amount), 0) INTO v_admin_commissions_drivers 
  FROM wallet_transactions 
  WHERE payment_type = 'commission'
  AND EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND w.user_id IN (SELECT user_id FROM drivers)
  );
  
  -- Get vendor balances
  SELECT COALESCE(SUM(balance), 0) INTO v_vendor_balances 
  FROM wallets 
  WHERE user_id IN (SELECT user_id FROM vendors);
  
  -- Get driver balances
  SELECT COALESCE(SUM(balance), 0) INTO v_driver_balances 
  FROM wallets 
  WHERE user_id IN (SELECT user_id FROM drivers);
  
  -- Build result
  v_result := jsonb_build_object(
    'total_sales', v_total_sales,
    'electronic_payments', v_electronic_payments,
    'cash_payments', v_cash_payments,
    'admin_commissions', v_admin_commissions,
    'admin_commissions_vendors', v_admin_commissions_vendors,
    'admin_commissions_drivers', v_admin_commissions_drivers,
    'vendor_balances', v_vendor_balances,
    'driver_balances', v_driver_balances
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;