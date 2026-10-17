/*
  # Wallet Transaction System
  
  1. New Tables
    - `vendor_commissions` - Stores commission records for vendors
    - `delivery_commissions` - Stores commission records for drivers
  
  2. New Functions
    - `process_order_payment` - Processes payment for an order, updating wallets and recording commissions
    - `handle_wallet_transaction` - Helper function to handle wallet transactions
  
  3. Triggers
    - `process_payment_on_order_completion` - Automatically processes payment when an order is completed
*/

-- Create vendor_commissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  rate numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, order_id)
);

-- Create delivery_commissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS delivery_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  rate numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(driver_id, order_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_vendor_id ON vendor_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_order_id ON vendor_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_commissions_driver_id ON delivery_commissions(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_commissions_order_id ON delivery_commissions(order_id);

-- Enable RLS on both tables
ALTER TABLE vendor_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies for vendor_commissions
CREATE POLICY "Vendors can view their own commissions"
  ON vendor_commissions
  FOR SELECT
  TO authenticated
  USING (vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all vendor commissions"
  ON vendor_commissions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- Create policies for delivery_commissions
CREATE POLICY "Drivers can view their own commissions"
  ON delivery_commissions
  FOR SELECT
  TO authenticated
  USING (driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all delivery commissions"
  ON delivery_commissions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- Create function to process order payment
CREATE OR REPLACE FUNCTION process_order_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_vendor record;
  v_driver record;
  v_vendor_wallet_id uuid;
  v_driver_wallet_id uuid;
  v_vendor_commission_rate numeric(5,2);
  v_driver_commission_rate numeric(5,2);
  v_vendor_commission_amount numeric(10,2);
  v_driver_commission_amount numeric(10,2);
  v_vendor_amount numeric(10,2);
  v_driver_amount numeric(10,2);
  v_vendor_transaction_id uuid;
  v_driver_transaction_id uuid;
  v_result jsonb;
BEGIN
  -- Check if payment was already processed
  IF EXISTS (
    SELECT 1 FROM wallet_transactions 
    WHERE order_id = p_order_id AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Payment already processed for this order'
    );
  END IF;

  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found'
    );
  END IF;
  
  -- Check if order is completed
  IF v_order.status != 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order is not completed'
    );
  END IF;
  
  -- Get vendor details
  SELECT v.*, COALESCE(v.commission_rate, 10) AS effective_commission_rate
  INTO v_vendor
  FROM vendors v
  WHERE v.id = v_order.vendor_id;
  
  IF v_vendor IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Vendor not found'
    );
  END IF;
  
  -- Get driver details if available
  IF v_order.driver_id IS NOT NULL THEN
    SELECT d.*, COALESCE(d.commission_rate, 15) AS effective_commission_rate
    INTO v_driver
    FROM drivers d
    WHERE d.id = v_order.driver_id;
  END IF;
  
  -- Calculate commission rates and amounts
  v_vendor_commission_rate := v_vendor.effective_commission_rate;
  v_vendor_commission_amount := (v_order.subtotal * v_vendor_commission_rate / 100)::numeric(10,2);
  v_vendor_amount := v_order.subtotal - v_vendor_commission_amount;
  
  -- Process vendor wallet transaction
  SELECT id INTO v_vendor_wallet_id
  FROM vendor_wallets
  WHERE vendor_id = v_vendor.id;
  
  IF v_vendor_wallet_id IS NULL THEN
    -- Create vendor wallet if it doesn't exist
    INSERT INTO vendor_wallets (vendor_id, balance, total_earnings, total_withdrawals)
    VALUES (v_vendor.id, 0, 0, 0)
    RETURNING id INTO v_vendor_wallet_id;
  END IF;
  
  -- Record vendor commission
  INSERT INTO vendor_commissions (
    vendor_id,
    order_id,
    amount,
    rate,
    status
  ) VALUES (
    v_vendor.id,
    p_order_id,
    v_vendor_commission_amount,
    v_vendor_commission_rate,
    'completed'
  );
  
  -- Add transaction for vendor
  INSERT INTO wallet_transactions (
    wallet_id,
    order_id,
    amount,
    type,
    payment_type,
    status,
    description
  ) VALUES (
    v_vendor_wallet_id,
    p_order_id,
    v_vendor_amount,
    'credit',
    v_order.payment_method,
    'completed',
    'مبلغ الطلب رقم ' || COALESCE(v_order.order_number, SUBSTRING(v_order.id::text, 1, 8))
  ) RETURNING id INTO v_vendor_transaction_id;
  
  -- Update vendor wallet balance
  UPDATE vendor_wallets
  SET 
    balance = balance + v_vendor_amount,
    total_earnings = total_earnings + v_vendor_amount,
    updated_at = NOW()
  WHERE id = v_vendor_wallet_id;
  
  -- Process driver wallet transaction if driver exists
  IF v_driver IS NOT NULL THEN
    v_driver_commission_rate := v_driver.effective_commission_rate;
    v_driver_commission_amount := (v_order.delivery_fee * v_driver_commission_rate / 100)::numeric(10,2);
    v_driver_amount := v_order.delivery_fee - v_driver_commission_amount;
    
    SELECT id INTO v_driver_wallet_id
    FROM driver_wallets
    WHERE driver_id = v_driver.id;
    
    IF v_driver_wallet_id IS NULL THEN
      -- Create driver wallet if it doesn't exist
      INSERT INTO driver_wallets (driver_id, balance, total_earnings, total_withdrawals)
      VALUES (v_driver.id, 0, 0, 0)
      RETURNING id INTO v_driver_wallet_id;
    END IF;
    
    -- Record driver commission
    INSERT INTO delivery_commissions (
      driver_id,
      order_id,
      amount,
      rate,
      status
    ) VALUES (
      v_driver.id,
      p_order_id,
      v_driver_commission_amount,
      v_driver_commission_rate,
      'completed'
    );
    
    -- Add transaction for driver
    INSERT INTO wallet_transactions (
      wallet_id,
      order_id,
      amount,
      type,
      payment_type,
      status,
      description
    ) VALUES (
      v_driver_wallet_id,
      p_order_id,
      v_driver_amount,
      'credit',
      v_order.payment_method,
      'completed',
      'رسوم توصيل الطلب رقم ' || COALESCE(v_order.order_number, SUBSTRING(v_order.id::text, 1, 8))
    ) RETURNING id INTO v_driver_transaction_id;
    
    -- Update driver wallet balance
    UPDATE driver_wallets
    SET 
      balance = balance + v_driver_amount,
      total_earnings = total_earnings + v_driver_amount,
      updated_at = NOW()
    WHERE id = v_driver_wallet_id;
  END IF;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'vendor_amount', v_vendor_amount,
    'vendor_commission', v_vendor_commission_amount,
    'vendor_transaction_id', v_vendor_transaction_id
  );
  
  IF v_driver IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'driver_amount', v_driver_amount,
      'driver_commission', v_driver_commission_amount,
      'driver_transaction_id', v_driver_transaction_id
    );
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error processing payment: ' || SQLERRM
    );
END;
$$;

-- Create trigger function to process payment when order is completed
CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process payment when status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Process payment
    PERFORM process_order_payment(NEW.order_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process payment when order status is updated to completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'handle_order_completion_trigger'
  ) THEN
    CREATE TRIGGER handle_order_completion_trigger
    AFTER UPDATE OF status ON order_status_history
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION handle_order_completion();
  END IF;
END
$$;

-- Create function to manually process payment for an order
CREATE OR REPLACE FUNCTION process_payment_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN process_order_payment(p_order_id);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_order_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_payment_for_order(uuid) TO authenticated;