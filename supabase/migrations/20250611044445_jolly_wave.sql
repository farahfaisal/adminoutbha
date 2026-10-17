/*
  # Fix wallet charging functionality

  1. Changes
    - Improve charge_driver_wallet_direct function to handle errors better
    - Improve charge_vendor_wallet_direct function to handle errors better
    - Add better transaction handling for wallet operations
*/

-- Create or replace function to charge driver wallet directly
CREATE OR REPLACE FUNCTION charge_driver_wallet_direct(
  p_driver_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT 'شحن رصيد مباشر'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Check if driver exists
  IF NOT EXISTS (SELECT 1 FROM drivers WHERE id = p_driver_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'السائق غير موجود'
    );
  END IF;

  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
  
  IF v_wallet_id IS NULL THEN
    -- Create wallet if it doesn't exist
    INSERT INTO driver_wallets (driver_id, balance, total_earnings, total_withdrawals)
    VALUES (p_driver_id, 0, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Add transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description
  )
  VALUES (
    v_wallet_id,
    p_amount,
    'credit',
    'admin_charge',
    'completed',
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet balance
  UPDATE driver_wallets
  SET 
    balance = balance + p_amount,
    total_earnings = total_earnings + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'message', 'تم شحن رصيد السائق بنجاح'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء شحن رصيد السائق: ' || SQLERRM
    );
END;
$$;

-- Create or replace function to charge vendor wallet directly
CREATE OR REPLACE FUNCTION charge_vendor_wallet_direct(
  p_vendor_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT 'شحن رصيد مباشر'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Check if vendor exists
  IF NOT EXISTS (SELECT 1 FROM vendors WHERE id = p_vendor_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'البائع غير موجود'
    );
  END IF;

  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM vendor_wallets WHERE vendor_id = p_vendor_id;
  
  IF v_wallet_id IS NULL THEN
    -- Create wallet if it doesn't exist
    INSERT INTO vendor_wallets (vendor_id, balance, total_earnings, total_withdrawals)
    VALUES (p_vendor_id, 0, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Add transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description
  )
  VALUES (
    v_wallet_id,
    p_amount,
    'credit',
    'admin_charge',
    'completed',
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet balance
  UPDATE vendor_wallets
  SET 
    balance = balance + p_amount,
    total_earnings = total_earnings + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'message', 'تم شحن رصيد البائع بنجاح'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء شحن رصيد البائع: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct TO service_role;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct TO service_role;
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct TO authenticated;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct TO authenticated;
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct TO anon;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct TO anon;