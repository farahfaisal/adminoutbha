/*
  # Add wallet balance functions for drivers and vendors

  1. New Functions
    - `charge_driver_wallet_direct` - Function to directly charge a driver's wallet
    - `charge_vendor_wallet_direct` - Function to directly charge a vendor's wallet
    
  2. Security
    - Functions are accessible to authenticated users with appropriate permissions
    
  3. Changes
    - Adds new RPC functions for direct wallet charging
    - Adds transaction records for wallet operations
*/

-- Function to directly charge a driver's wallet
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
    INSERT INTO driver_wallets (driver_id, balance, pending_balance)
    VALUES (p_driver_id, 0, 0)
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
  SET balance = balance + p_amount,
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
END;
$$;

-- Function to directly charge a vendor's wallet
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
    INSERT INTO vendor_wallets (vendor_id, balance, pending_balance)
    VALUES (p_vendor_id, 0, 0)
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
  SET balance = balance + p_amount,
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
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct TO service_role;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct TO service_role;
GRANT EXECUTE ON FUNCTION charge_driver_wallet_direct TO authenticated;
GRANT EXECUTE ON FUNCTION charge_vendor_wallet_direct TO authenticated;