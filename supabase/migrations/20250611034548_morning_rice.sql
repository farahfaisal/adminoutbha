/*
  # Fix vendor type constraint

  1. Changes
    - Modify the vendors_type_check constraint to allow more category types
    - Add a function to safely update vendor type when linking to a category
*/

-- First, drop the existing constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_type_check;

-- Create a new constraint with more allowed values
-- This includes common vendor category types
ALTER TABLE vendors ADD CONSTRAINT vendors_type_check 
  CHECK (type = ANY (ARRAY[
    'مطاعم'::text,     -- Restaurants
    'ماركت'::text,     -- Market
    'سوبر ماركت'::text, -- Supermarket
    'مقاهي'::text,     -- Cafes
    'حلويات'::text,    -- Desserts/Sweets
    'other'::text      -- Other types
  ]));

-- Create a function to update vendor type when linking to a category
-- This function will map category names to valid vendor types
CREATE OR REPLACE FUNCTION update_vendor_type_from_category(
  p_vendor_id UUID,
  p_category_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
BEGIN
  -- Map category name to valid vendor type
  CASE
    WHEN p_category_name = 'مطاعم' THEN v_type := 'مطاعم';
    WHEN p_category_name = 'ماركت' OR p_category_name = 'سوبر ماركت' THEN v_type := 'ماركت';
    WHEN p_category_name = 'مقاهي' THEN v_type := 'مطاعم'; -- Map cafes to restaurants
    WHEN p_category_name = 'حلويات' THEN v_type := 'مطاعم'; -- Map desserts to restaurants
    ELSE v_type := 'other';
  END CASE;
  
  -- Update vendor type
  UPDATE vendors
  SET type = v_type
  WHERE id = p_vendor_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_vendor_type_from_category(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_vendor_type_from_category(UUID, TEXT) TO anon;