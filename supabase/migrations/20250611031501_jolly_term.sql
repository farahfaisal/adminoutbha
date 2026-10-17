/*
  # Add vendor type column
  
  1. Changes
    - Add `type` column to vendors table to specify vendor category type
    - Add check constraint to ensure valid types
    - Create index for better query performance
*/

-- Add type column to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'type'
  ) THEN
    ALTER TABLE vendors ADD COLUMN type text DEFAULT 'مطاعم'::text;
    
    -- Add check constraint for valid types
    ALTER TABLE vendors ADD CONSTRAINT vendors_type_check 
      CHECK (type = ANY (ARRAY['مطاعم'::text, 'ماركت'::text, 'other'::text]));
    
    -- Create index for better query performance
    CREATE INDEX idx_vendors_type ON vendors(type);
  END IF;
END $$;

-- Update existing vendors to have a default type if needed
UPDATE vendors SET type = 'مطاعم' WHERE type IS NULL;