/*
  # Fix driver waiting list functionality

  1. New Functions
    - `add_order_to_waiting_list` - Adds an order to the driver waiting list
    - `get_waiting_list_orders` - Gets orders in the waiting list
    
  2. Security
    - Enable RLS on driver_waiting_list table
    - Add policies for authenticated users
*/

-- Create function to add an order to the waiting list
CREATE OR REPLACE FUNCTION add_order_to_waiting_list(
  p_order_id UUID,
  p_vendor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order_exists BOOLEAN;
BEGIN
  -- Check if order exists
  SELECT EXISTS(
    SELECT 1 FROM orders WHERE id = p_order_id
  ) INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Check if order is already in waiting list
  IF EXISTS(
    SELECT 1 FROM driver_waiting_list WHERE order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'Order already in waiting list';
  END IF;
  
  -- Add order to waiting list
  INSERT INTO driver_waiting_list (
    order_id,
    vendor_id,
    status,
    created_at
  ) VALUES (
    p_order_id,
    p_vendor_id,
    'pending',
    now()
  );
  
  -- Update order status
  UPDATE orders
  SET status = 'waiting-for-driver'
  WHERE id = p_order_id;
  
  -- Add status history record
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_at
  ) VALUES (
    p_order_id,
    'waiting-for-driver',
    'تم إضافة الطلب لقائمة انتظار السائقين',
    now()
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding order to waiting list: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get orders in the waiting list
CREATE OR REPLACE FUNCTION get_waiting_list_orders(
  p_vendor_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'pending'
)
RETURNS SETOF driver_waiting_list AS $$
BEGIN
  IF p_vendor_id IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM driver_waiting_list
    WHERE vendor_id = p_vendor_id
    AND status = p_status
    ORDER BY created_at ASC;
  ELSE
    RETURN QUERY
    SELECT *
    FROM driver_waiting_list
    WHERE status = p_status
    ORDER BY created_at ASC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on driver_waiting_list table
ALTER TABLE driver_waiting_list ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_waiting_list table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_waiting_list' AND policyname = 'Authenticated users can view waiting list'
  ) THEN
    CREATE POLICY "Authenticated users can view waiting list"
      ON driver_waiting_list
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_waiting_list' AND policyname = 'Authenticated users can insert into waiting list'
  ) THEN
    CREATE POLICY "Authenticated users can insert into waiting list"
      ON driver_waiting_list
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_waiting_list' AND policyname = 'Authenticated users can update waiting list'
  ) THEN
    CREATE POLICY "Authenticated users can update waiting list"
      ON driver_waiting_list
      FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create index on driver_waiting_list for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_order_id ON driver_waiting_list(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_vendor_id ON driver_waiting_list(vendor_id);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_status ON driver_waiting_list(status);