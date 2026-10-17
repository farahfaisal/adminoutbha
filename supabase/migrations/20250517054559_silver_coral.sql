/*
  # Fix Order Status Update

  1. New Functions
    - Adds a new function `update_order_status_simple` that simplifies the order status update process
    - Adds a function to check if an order exists

  2. Security
    - Adds proper error handling for order status updates
    - Improves security by validating input parameters
*/

-- Create a simple function to check if an order exists
CREATE OR REPLACE FUNCTION order_exists(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM orders WHERE id = p_order_id);
END;
$$;

-- Create a simplified order status update function
CREATE OR REPLACE FUNCTION update_order_status_simple(
  p_order_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate parameters
  IF p_order_id IS NULL OR p_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if order exists
  IF NOT order_exists(p_order_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Add status history record
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  )
  VALUES (
    p_order_id,
    p_status,
    p_note,
    v_user_id
  );
  
  -- Update order status
  UPDATE orders
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION order_exists TO service_role;
GRANT EXECUTE ON FUNCTION order_exists TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status_simple TO service_role;
GRANT EXECUTE ON FUNCTION update_order_status_simple TO authenticated;