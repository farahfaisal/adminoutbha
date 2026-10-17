/*
  # Add featured column to vendors table

  1. Changes
    - Add featured column to vendors table
    - Add featured_until column to vendors table if it doesn't exist
    - Add featured_order column to vendors table if it doesn't exist
*/

-- Add featured column to vendors table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'featured'
  ) THEN
    ALTER TABLE vendors ADD COLUMN featured boolean DEFAULT false;
  END IF;
END
$$;

-- Make sure featured_until column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'featured_until'
  ) THEN
    -- If it doesn't exist, add it
    ALTER TABLE vendors ADD COLUMN featured_until timestamptz DEFAULT NULL;
  END IF;
END
$$;

-- Make sure featured_order column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'featured_order'
  ) THEN
    -- If it doesn't exist, add it
    ALTER TABLE vendors ADD COLUMN featured_order integer DEFAULT NULL;
  END IF;
END
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendors_featured_until ON vendors(featured_until);
CREATE INDEX IF NOT EXISTS idx_vendors_featured_order ON vendors(featured_order);

-- Create function to toggle vendor featured status
CREATE OR REPLACE FUNCTION toggle_vendor_featured(
  p_vendor_id uuid,
  p_featured boolean,
  p_featured_until timestamptz DEFAULT NULL,
  p_featured_order integer DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Update vendor
  UPDATE vendors
  SET 
    featured = p_featured,
    featured_until = CASE WHEN p_featured THEN COALESCE(p_featured_until, (CURRENT_DATE + INTERVAL '30 days')::timestamptz) ELSE NULL END,
    featured_order = CASE WHEN p_featured THEN COALESCE(p_featured_order, 1) ELSE NULL END,
    updated_at = now()
  WHERE id = p_vendor_id
  RETURNING row_to_json(vendors.*)::jsonb INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;