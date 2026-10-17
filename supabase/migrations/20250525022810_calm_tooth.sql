/*
  # Fix vendor lookup function

  1. New Functions
    - `find_vendor_by_name` - Function to find a vendor ID by store name
      - Takes a store name parameter and returns the vendor ID
      - Handles case-insensitive search for better matching
      - Returns NULL if no vendor is found

  2. Security
    - Function is set as SECURITY DEFINER to ensure it can be executed by any authenticated user
    - Execute permission is granted to authenticated users
*/

-- Create or replace the function to find a vendor by name
CREATE OR REPLACE FUNCTION public.find_vendor_by_name(p_store_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_id uuid;
BEGIN
  -- First try exact match
  SELECT id INTO v_vendor_id
  FROM vendors
  WHERE store_name = p_store_name
  LIMIT 1;
  
  -- If not found, try case-insensitive match
  IF v_vendor_id IS NULL THEN
    SELECT id INTO v_vendor_id
    FROM vendors
    WHERE LOWER(store_name) = LOWER(p_store_name)
    LIMIT 1;
  END IF;
  
  -- If still not found, try partial match
  IF v_vendor_id IS NULL THEN
    SELECT id INTO v_vendor_id
    FROM vendors
    WHERE store_name ILIKE '%' || p_store_name || '%'
    LIMIT 1;
  END IF;
  
  RETURN v_vendor_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_vendor_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_vendor_by_name(text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_vendor_by_name(text) TO service_role;