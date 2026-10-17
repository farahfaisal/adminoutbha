-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_order_status_history(uuid);
DROP FUNCTION IF EXISTS assign_trip_to_driver(uuid, uuid);

-- Create improved get_order_status_history function with proper table aliases
CREATE OR REPLACE FUNCTION get_order_status_history(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  status text,
  note text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  preparation_time_minutes integer,
  driver_name text,
  created_by_name text,
  created_by_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    osh.id,
    osh.order_id,
    osh.status,
    osh.note,
    osh.created_by,
    osh.created_at,
    osh.updated_at,
    osh.preparation_time_minutes,
    osh.driver_name,
    cu.name as created_by_name,
    cu.role as created_by_role
  FROM order_status_history osh
  LEFT JOIN custom_users cu ON cu.id = osh.created_by
  WHERE osh.order_id = p_order_id
  ORDER BY osh.created_at ASC;
END;
$$;

-- Update RLS policies for driver_waiting_list table
-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow viewing all waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Authenticated users can insert into waiting list" ON driver_waiting_list;
DROP POLICY IF EXISTS "Authenticated users can update waiting list" ON driver_waiting_list;
DROP POLICY IF EXISTS "Authenticated users can view waiting list" ON driver_waiting_list;
DROP POLICY IF EXISTS "Drivers can update waiting list" ON driver_waiting_list;
DROP POLICY IF EXISTS "Drivers can view available orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Vendors can manage waiting list" ON driver_waiting_list;
DROP POLICY IF EXISTS "Vendors can view their own waiting list orders" ON driver_waiting_list;

-- Create comprehensive RLS policies for driver_waiting_list
CREATE POLICY "Public can view waiting list orders"
  ON driver_waiting_list
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert waiting list orders"
  ON driver_waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Public can insert waiting list orders"
  ON driver_waiting_list
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can update waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Vendors can manage their waiting list orders"
  ON driver_waiting_list
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors v 
      WHERE v.id = driver_waiting_list.vendor_id 
      AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors v 
      WHERE v.id = driver_waiting_list.vendor_id 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can claim waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers d 
      WHERE d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d 
      WHERE d.user_id = auth.uid()
    )
  );

-- Ensure order_status_history has proper RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert into order status history" ON order_status_history;
DROP POLICY IF EXISTS "Authenticated users can update their own status records" ON order_status_history;
DROP POLICY IF EXISTS "Authenticated users can view order status history" ON order_status_history;
DROP POLICY IF EXISTS "Public can manage order status history" ON order_status_history;

-- Create comprehensive RLS policies for order_status_history
CREATE POLICY "Public can view order status history"
  ON order_status_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert order status history"
  ON order_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Public can insert order status history"
  ON order_status_history
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order status history"
  ON order_status_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can update order status history"
  ON order_status_history
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create helper function to find vendor by name (if it doesn't exist)
DROP FUNCTION IF EXISTS find_vendor_by_name(text);
CREATE OR REPLACE FUNCTION find_vendor_by_name(p_store_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vendor_id uuid;
BEGIN
  SELECT id INTO vendor_id
  FROM vendors
  WHERE store_name = p_store_name
  LIMIT 1;
  
  RETURN vendor_id;
END;
$$;

-- Create function to assign trip to driver with json return type
CREATE OR REPLACE FUNCTION assign_trip_to_driver(p_order_id uuid, p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  driver_name text;
BEGIN
  -- Get driver name
  SELECT name INTO driver_name
  FROM drivers
  WHERE id = p_driver_id;
  
  IF driver_name IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Insert into driver_trips
  INSERT INTO driver_trips (
    order_id,
    driver_id,
    status,
    assigned_at
  ) VALUES (
    p_order_id,
    p_driver_id,
    'assigned',
    NOW()
  );
  
  -- Update order with driver info
  UPDATE orders 
  SET 
    driver_id = p_driver_id,
    driver_name = driver_name,
    status = 'delivering',
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'driver_name', driver_name,
    'order_id', p_order_id
  );
  
  RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_order_status_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_status_history(uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_vendor_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION find_vendor_by_name(text) TO anon;
GRANT EXECUTE ON FUNCTION assign_trip_to_driver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_trip_to_driver(uuid, uuid) TO anon;