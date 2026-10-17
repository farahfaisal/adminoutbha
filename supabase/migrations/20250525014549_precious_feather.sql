/*
  # Add vendor lookup function

  1. New Functions
    - `find_vendor_by_name`: Looks up a vendor by store name
      - Input: store_name (text)
      - Output: vendor id (uuid)
      - Returns null if no vendor found

  2. Security
    - Function is accessible to authenticated users
*/

CREATE OR REPLACE FUNCTION public.find_vendor_by_name(p_store_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_id uuid;
BEGIN
  SELECT id INTO v_vendor_id
  FROM vendors
  WHERE store_name = p_store_name
  LIMIT 1;
  
  RETURN v_vendor_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_vendor_by_name(text) TO authenticated;