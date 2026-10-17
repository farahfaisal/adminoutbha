/*
  # Fix Order Status Update

  1. New Functions
    - `update_order_status_v2`: Improved function to update order status and add history in a transaction
    - `assign_driver_to_order`: Function to assign a driver to an order and update status
    - `get_order_with_details`: Function to get order details with related entities

  2. Security
    - Enable RLS on order_status_history table
    - Add policies for authenticated users
*/

-- Create improved function to update order status
CREATE OR REPLACE FUNCTION update_order_status_v2(
  p_order_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Begin transaction
  BEGIN
    -- Update order status
    UPDATE orders
    SET 
      status = p_status,
      updated_at = now()
    WHERE id = p_order_id;
    
    -- Add status history record
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_at,
      created_by
    ) VALUES (
      p_order_id,
      p_status,
      COALESCE(p_note, 
        CASE 
          WHEN p_status = 'processing' THEN 'تم بدء تحضير الطلب'
          WHEN p_status = 'delivering' THEN 'تم تحويل الطلب للتوصيل'
          WHEN p_status = 'waiting-for-driver' THEN 'تم إضافة الطلب لقائمة انتظار السائقين'
          WHEN p_status = 'completed' THEN 'تم إكمال الطلب'
          WHEN p_status = 'accepted' THEN 'تم قبول الطلب'
          WHEN p_status = 'rejected' THEN 'تم رفض الطلب'
          WHEN p_status = 'cancelled' THEN 'تم إلغاء الطلب'
          ELSE 'تم تغيير الحالة'
        END),
      now(),
      v_user_id
    );
    
    -- Get updated order
    SELECT jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'updated_at', o.updated_at,
      'success', true
    ) INTO v_result
    FROM orders o
    WHERE o.id = p_order_id;
    
    -- Return success
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic in case of error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign driver to order
CREATE OR REPLACE FUNCTION assign_driver_to_order(
  p_order_id UUID,
  p_driver_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_driver_name TEXT;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Get driver name
  SELECT name INTO v_driver_name
  FROM drivers
  WHERE id = p_driver_id;
  
  -- Begin transaction
  BEGIN
    -- Update order
    UPDATE orders
    SET 
      driver_id = p_driver_id,
      status = 'delivering',
      updated_at = now()
    WHERE id = p_order_id;
    
    -- Add status history record
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_at,
      created_by
    ) VALUES (
      p_order_id,
      'delivering',
      COALESCE(p_note, 'تم تعيين السائق ' || v_driver_name),
      now(),
      v_user_id
    );
    
    -- Get updated order
    SELECT jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'driver_id', o.driver_id,
      'driver_name', d.name,
      'updated_at', o.updated_at,
      'success', true
    ) INTO v_result
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    WHERE o.id = p_order_id;
    
    -- Return success
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic in case of error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get order with details
CREATE OR REPLACE FUNCTION get_order_with_details(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'total', o.total,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'customer', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', c.phone
    ),
    'vendor', jsonb_build_object(
      'id', v.id,
      'store_name', v.store_name,
      'phone', v.phone
    ),
    'driver', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'phone', d.phone
    ) ELSE NULL END,
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price,
        'product', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'price', p.price
        )
      ))
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = o.id
    )
  ) INTO v_result
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  LEFT JOIN vendors v ON o.vendor_id = v.id
  LEFT JOIN drivers d ON o.driver_id = d.id
  WHERE o.id = p_order_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get order status history with user details
CREATE OR REPLACE FUNCTION get_order_status_history_with_users(
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  user_name TEXT,
  user_role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    osh.id,
    osh.order_id,
    osh.status,
    osh.note,
    osh.created_at,
    osh.created_by,
    COALESCE(cu.name, 'النظام') AS user_name,
    COALESCE(cu.role, 'system') AS user_role
  FROM 
    order_status_history osh
  LEFT JOIN 
    custom_users cu ON osh.created_by = cu.id
  WHERE 
    osh.order_id = p_order_id
  ORDER BY 
    osh.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure order_status_history table has RLS enabled
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies for order_status_history table
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Authenticated users can view order status history" ON order_status_history;
  DROP POLICY IF EXISTS "Authenticated users can insert into order status history" ON order_status_history;
  
  -- Create new policies
  CREATE POLICY "Authenticated users can view order status history"
    ON order_status_history
    FOR SELECT
    TO authenticated
    USING (true);
    
  CREATE POLICY "Authenticated users can insert into order status history"
    ON order_status_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
END $$;

-- Create indexes on order_status_history for faster queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_by ON order_status_history(created_by);