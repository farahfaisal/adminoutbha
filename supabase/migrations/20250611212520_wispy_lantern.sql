/*
  # Fix wallet transactions type and payment_type

  1. Changes
    - Update wallet_transactions_type_check constraint to include 'admin_charge'
    - Update wallet_transactions_payment_type_check constraint to include 'admin_charge'
    - Drop and recreate charge_vendor_wallet_direct and charge_driver_wallet_direct functions
*/

-- Update the type check constraint to include 'admin_charge'
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type = ANY (ARRAY['order_payment'::text, 'withdrawal'::text, 'system_fee'::text, 'admin_charge'::text, 'credit'::text, 'debit'::text]));

-- Update the payment_type check constraint to include 'admin_charge'
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_payment_type_check;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_payment_type_check 
CHECK (payment_type = ANY (ARRAY['cash'::text, 'electronic'::text, 'wallet'::text, 'withdrawal'::text, 'commission'::text, 'admin_charge'::text]));

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS charge_vendor_wallet_direct(uuid, numeric, text);
DROP FUNCTION IF EXISTS charge_driver_wallet_direct(uuid, numeric, text);

-- Create function to charge vendor wallet directly
CREATE OR REPLACE FUNCTION charge_vendor_wallet_direct(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'شحن رصيد بواسطة المدير'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Get or create vendor wallet
  SELECT id INTO v_wallet_id
  FROM vendor_wallets
  WHERE vendor_id = p_vendor_id;
  
  -- If wallet doesn't exist, create it
  IF v_wallet_id IS NULL THEN
    INSERT INTO vendor_wallets (vendor_id, balance, total_earnings, total_withdrawals)
    VALUES (p_vendor_id, 0, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description
  ) VALUES (
    v_wallet_id,
    p_amount,
    'credit',
    'admin_charge',
    'completed',
    p_description
  ) RETURNING id INTO v_transaction_id;
  
  -- Update wallet balance
  UPDATE vendor_wallets
  SET 
    balance = balance + p_amount,
    total_earnings = total_earnings + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'wallet_id', v_wallet_id,
    'amount', p_amount,
    'message', 'تم شحن الرصيد بنجاح'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'فشل في شحن الرصيد'
    );
    RETURN v_result;
END;
$$;

-- Create function to charge driver wallet directly
CREATE OR REPLACE FUNCTION charge_driver_wallet_direct(
  p_driver_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'شحن رصيد بواسطة المدير'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Get or create driver wallet
  SELECT id INTO v_wallet_id
  FROM driver_wallets
  WHERE driver_id = p_driver_id;
  
  -- If wallet doesn't exist, create it
  IF v_wallet_id IS NULL THEN
    INSERT INTO driver_wallets (driver_id, balance, total_earnings, total_withdrawals)
    VALUES (p_driver_id, 0, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Create transaction record with proper payment_type
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description
  ) VALUES (
    v_wallet_id,
    p_amount,
    'credit',
    'admin_charge',
    'completed',
    p_description
  ) RETURNING id INTO v_transaction_id;
  
  -- Update wallet balance
  UPDATE driver_wallets
  SET 
    balance = balance + p_amount,
    total_earnings = total_earnings + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'wallet_id', v_wallet_id,
    'amount', p_amount,
    'message', 'تم شحن الرصيد بنجاح'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'فشل في شحن الرصيد'
    );
    RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct(UUID, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct(UUID, NUMERIC, TEXT) TO anon;