/*
  # Driver Trips Management

  1. New Tables
    - `driver_trips` - Stores information about driver delivery trips
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `driver_id` (uuid, references drivers)
      - `status` (text, with check constraint)
      - Various trip details and timestamps
  
  2. Indexes
    - Added indexes for better query performance
  
  3. Security
    - Enabled RLS on the table
    - Added policies for drivers, vendors, and admins
  
  4. Functions
    - `assign_trip_to_driver` - Assigns a trip to a driver
    - `update_trip_status` - Updates trip status with proper order status sync
    - Added trigger for order completion when trip is completed
*/

-- Create driver_trips table
CREATE TABLE IF NOT EXISTS driver_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  customer_name text,
  customer_phone text,
  pickup_address text,
  delivery_address text,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_trips_order_id ON driver_trips(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_trips_driver_id ON driver_trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_trips_status ON driver_trips(status);
CREATE INDEX IF NOT EXISTS idx_driver_trips_assigned_at ON driver_trips(assigned_at);

-- Enable RLS
ALTER TABLE driver_trips ENABLE ROW LEVEL SECURITY;

-- Create policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_trips' AND policyname = 'Drivers can view their own trips'
  ) THEN
    CREATE POLICY "Drivers can view their own trips"
      ON driver_trips
      FOR SELECT
      TO authenticated
      USING (driver_id = auth.uid() OR EXISTS (
        SELECT 1 FROM drivers WHERE drivers.id = driver_trips.driver_id AND drivers.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_trips' AND policyname = 'Vendors can view trips for their orders'
  ) THEN
    CREATE POLICY "Vendors can view trips for their orders"
      ON driver_trips
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM orders
        JOIN vendors ON vendors.id = orders.vendor_id
        WHERE orders.id = driver_trips.order_id AND vendors.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_trips' AND policyname = 'Admins can view all trips'
  ) THEN
    CREATE POLICY "Admins can view all trips"
      ON driver_trips
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_trips' AND policyname = 'Drivers can update their own trips'
  ) THEN
    CREATE POLICY "Drivers can update their own trips"
      ON driver_trips
      FOR UPDATE
      TO authenticated
      USING (driver_id = auth.uid() OR EXISTS (
        SELECT 1 FROM drivers WHERE drivers.id = driver_trips.driver_id AND drivers.user_id = auth.uid()
      ))
      WITH CHECK (driver_id = auth.uid() OR EXISTS (
        SELECT 1 FROM drivers WHERE drivers.id = driver_trips.driver_id AND drivers.user_id = auth.uid()
      ));
  END IF;
END
$$;

-- Create function to assign trip to driver
CREATE OR REPLACE FUNCTION assign_trip_to_driver(
  p_order_id uuid,
  p_driver_id uuid
) RETURNS uuid AS $$
DECLARE
  v_trip_id uuid;
  v_order_data orders;
  v_customer_name text;
  v_customer_phone text;
  v_pickup_address text;
  v_delivery_address text;
BEGIN
  -- Get order data
  SELECT * INTO v_order_data FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Get customer data
  SELECT name, phone INTO v_customer_name, v_customer_phone
  FROM customers
  WHERE id = v_order_data.customer_id;
  
  -- Get vendor address as pickup address
  SELECT address INTO v_pickup_address
  FROM vendors
  WHERE id = v_order_data.vendor_id;
  
  -- Set delivery address
  v_delivery_address := v_order_data.address;
  
  -- Insert trip
  INSERT INTO driver_trips (
    order_id,
    driver_id,
    status,
    customer_name,
    customer_phone,
    pickup_address,
    delivery_address,
    total,
    payment_method,
    notes
  ) VALUES (
    p_order_id,
    p_driver_id,
    'assigned',
    COALESCE(v_order_data.customer_name, v_customer_name),
    COALESCE(v_order_data.customer_phone, v_customer_phone),
    v_pickup_address,
    v_delivery_address,
    v_order_data.total,
    v_order_data.payment_method,
    v_order_data.notes
  ) RETURNING id INTO v_trip_id;
  
  -- Update order status and driver
  UPDATE orders
  SET 
    status = 'delivering',
    driver_id = p_driver_id,
    driver_name = (SELECT name FROM drivers WHERE id = p_driver_id),
    updated_at = now()
  WHERE id = p_order_id;
  
  -- Add to order status history
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  ) VALUES (
    p_order_id,
    'delivering',
    'تم تعيين السائق وبدء التوصيل',
    (SELECT user_id FROM drivers WHERE id = p_driver_id)
  );
  
  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update trip status
CREATE OR REPLACE FUNCTION update_trip_status(
  p_trip_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_trip driver_trips;
  v_order_status text;
BEGIN
  -- Get trip data
  SELECT * INTO v_trip FROM driver_trips WHERE id = p_trip_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;
  
  -- Validate status
  IF p_status NOT IN ('assigned', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  
  -- Map trip status to order status
  CASE p_status
    WHEN 'assigned' THEN v_order_status := 'delivering';
    WHEN 'in_progress' THEN v_order_status := 'delivering';
    WHEN 'completed' THEN v_order_status := 'completed';
    WHEN 'cancelled' THEN v_order_status := 'cancelled';
  END CASE;
  
  -- Update trip
  UPDATE driver_trips
  SET 
    status = p_status,
    started_at = CASE WHEN p_status = 'in_progress' AND v_trip.started_at IS NULL THEN now() ELSE v_trip.started_at END,
    completed_at = CASE WHEN p_status = 'completed' AND v_trip.completed_at IS NULL THEN now() ELSE v_trip.completed_at END,
    updated_at = now()
  WHERE id = p_trip_id;
  
  -- Update order status
  UPDATE orders
  SET 
    status = v_order_status,
    updated_at = now()
  WHERE id = v_trip.order_id;
  
  -- Add to order status history
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  ) VALUES (
    v_trip.order_id,
    v_order_status,
    COALESCE(p_note, 'تم تحديث حالة الرحلة إلى ' || p_status),
    (SELECT user_id FROM drivers WHERE id = v_trip.driver_id)
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_driver_trips_updated_at'
  ) THEN
    CREATE TRIGGER update_driver_trips_updated_at
    BEFORE UPDATE ON driver_trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- Create trigger to complete order when trip is completed
CREATE OR REPLACE FUNCTION complete_order_on_delivery() RETURNS TRIGGER AS $$
BEGIN
  -- When a driver marks a delivery as completed, update the order status
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update the order status
    UPDATE orders
    SET 
      status = 'completed',
      updated_at = now()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists to avoid errors
DROP TRIGGER IF EXISTS complete_order_on_delivery_trigger ON driver_trips;

-- Create the trigger
CREATE TRIGGER complete_order_on_delivery_trigger
AFTER UPDATE OF status ON driver_trips
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION complete_order_on_delivery();