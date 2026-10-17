-- Create parcel_orders table
CREATE TABLE IF NOT EXISTS parcel_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  
  -- Sender information
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  sender_address text NOT NULL,
  sender_city text,
  sender_latitude numeric,
  sender_longitude numeric,
  
  -- Receiver information
  receiver_name text NOT NULL,
  receiver_phone text NOT NULL,
  receiver_address text NOT NULL,
  receiver_city text,
  receiver_latitude numeric,
  receiver_longitude numeric,
  
  -- Parcel details
  parcel_type text DEFAULT 'package',
  weight numeric,
  dimensions jsonb,
  description text,
  images jsonb DEFAULT '[]'::jsonb,
  notes text,
  
  -- Delivery information
  driver_id uuid REFERENCES drivers(id),
  delivery_fee numeric NOT NULL DEFAULT 0,
  estimated_delivery_time integer DEFAULT 30,
  actual_delivery_time timestamp with time zone,
  
  -- Payment information
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'electronic')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  
  -- Order status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'rejected')),
  
  -- Service area
  service_area_id uuid REFERENCES service_areas(id),
  
  -- Distance and pricing
  distance numeric,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

-- Enable RLS
ALTER TABLE parcel_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for admin users
CREATE POLICY "Admins can view all parcel orders"
  ON parcel_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert parcel orders"
  ON parcel_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update parcel orders"
  ON parcel_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete parcel orders"
  ON parcel_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create policies for drivers
CREATE POLICY "Drivers can view their assigned parcel orders"
  ON parcel_orders FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update their assigned parcel orders"
  ON parcel_orders FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers
      WHERE user_id = auth.uid()
    )
  );

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_parcel_order_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM parcel_orders;
  new_number := 'P' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_parcel_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_parcel_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_parcel_order
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_parcel_order_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parcel_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_update_parcel_order
  BEFORE UPDATE ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_parcel_order_timestamp();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parcel_orders_driver_id ON parcel_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_parcel_orders_service_area_id ON parcel_orders(service_area_id);
CREATE INDEX IF NOT EXISTS idx_parcel_orders_status ON parcel_orders(status);
CREATE INDEX IF NOT EXISTS idx_parcel_orders_created_at ON parcel_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_orders_order_number ON parcel_orders(order_number);