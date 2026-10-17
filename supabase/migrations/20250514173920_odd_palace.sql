-- Add vendor_category_id column to advertisements table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'advertisements' AND column_name = 'vendor_category_id'
  ) THEN
    ALTER TABLE advertisements ADD COLUMN vendor_category_id UUID REFERENCES vendor_categories_table(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on the new column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_advertisements_vendor_category_id'
  ) THEN
    CREATE INDEX idx_advertisements_vendor_category_id ON advertisements(vendor_category_id);
  END IF;
END $$;

-- Update the position check constraint to include vendor_category if it exists
DO $$ 
BEGIN
  -- First drop the existing constraint if it exists
  BEGIN
    ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_position_check;
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;

  -- Create the updated constraint
  ALTER TABLE advertisements ADD CONSTRAINT advertisements_position_check 
    CHECK ("position" IN ('home', 'category', 'product', 'checkout', 'vendor_category'));
END $$;

-- Create function to get advertisements by vendor category
CREATE OR REPLACE FUNCTION get_advertisements_by_vendor_category(
  p_category_id UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  vendor_id UUID,
  vendor_name TEXT,
  image_url TEXT,
  link TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT,
  ad_type TEXT,
  ad_position TEXT,
  priority INTEGER,
  clicks INTEGER,
  views INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.vendor_id,
    v.store_name AS vendor_name,
    a.image_url,
    a.link,
    a.start_date,
    a.end_date,
    a.status,
    a.type AS ad_type,
    a."position" AS ad_position,
    a.priority,
    a.clicks,
    a.views
  FROM 
    advertisements a
    LEFT JOIN vendors v ON a.vendor_id = v.id
  WHERE 
    a.vendor_category_id = p_category_id
    AND a.status = 'active'
    AND a.start_date <= CURRENT_DATE
    AND a.end_date >= CURRENT_DATE
  ORDER BY 
    a.priority ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;