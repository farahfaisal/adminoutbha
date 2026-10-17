/*
  # Fix order status update functionality

  1. Functions
    - `update_order_status` - Function to update order status and add history record
    - `get_order_status_history` - Function to get order status history

  2. Indexes
    - Add index on order_status_history for faster queries
*/

-- Create function to update order status
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
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
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating order status: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get order status history
CREATE OR REPLACE FUNCTION get_order_status_history_v2(
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  user_name TEXT
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
    COALESCE(cu.name, 'النظام') AS user_name
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

-- Create index on order_status_history for faster queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);

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