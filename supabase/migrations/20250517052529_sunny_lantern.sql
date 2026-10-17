-- Add toast import to OrderProcessing component
-- This migration adds support for toast notifications in the OrderProcessing component

-- Create a function to check if a user has permission to update order status
CREATE OR REPLACE FUNCTION can_update_order_status(
  p_user_id UUID,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_vendor_id UUID;
  v_is_vendor_owner BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role FROM custom_users WHERE id = p_user_id;
  
  -- Admin can always update
  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Get vendor ID from order
  SELECT vendor_id INTO v_vendor_id FROM orders WHERE id = p_order_id;
  
  -- Check if user is vendor owner
  SELECT EXISTS(
    SELECT 1 FROM vendors 
    WHERE id = v_vendor_id AND user_id = p_user_id
  ) INTO v_is_vendor_owner;
  
  -- Vendor owner can update their own orders
  IF v_is_vendor_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Default: no permission
  RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION can_update_order_status TO service_role;
GRANT EXECUTE ON FUNCTION can_update_order_status TO authenticated;