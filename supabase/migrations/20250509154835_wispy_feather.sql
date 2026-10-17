/*
  # Update Vendor Status Options

  1. Changes
    - Update the status check constraint in vendors table to include 'busy' status
    - Add function to update vendor status
*/

-- Update the status check constraint in vendors table
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_status_check 
  CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'busy'));

-- Create function to update vendor status
CREATE OR REPLACE FUNCTION update_vendor_status(
  p_vendor_id uuid,
  p_status text
)
RETURNS boolean AS $$
BEGIN
  -- Validate status
  IF p_status NOT IN ('active', 'inactive', 'pending', 'suspended', 'busy') THEN
    RETURN false;
  END IF;
  
  -- Update vendor status
  UPDATE vendors
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_vendor_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;