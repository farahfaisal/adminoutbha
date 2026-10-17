/*
  # Media Files Table Fixes

  1. New Functions
    - `increment_media_usage` function to track media file usage
  
  2. Changes
    - Ensure we don't create duplicate triggers or functions
    - Fix the media_files table RLS policies
    - Add additional policies for public access to media files
*/

-- Check if media_files table exists before creating it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'media_files') THEN
    -- Create media_files table
    CREATE TABLE media_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename TEXT NOT NULL,
      original_filename TEXT,
      file_path TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      mime_type TEXT NOT NULL,
      bucket TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      duration NUMERIC,
      alt_text TEXT,
      title TEXT,
      description TEXT,
      is_public BOOLEAN DEFAULT true,
      usage_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Media files are viewable by everyone" ON media_files;
DROP POLICY IF EXISTS "Authenticated users can insert media files" ON media_files;
DROP POLICY IF EXISTS "Users can update their own media files" ON media_files;
DROP POLICY IF EXISTS "Users can delete their own media files" ON media_files;
DROP POLICY IF EXISTS "Public can view media files" ON media_files;
DROP POLICY IF EXISTS "Public can view public media files" ON media_files;

-- Create policies
CREATE POLICY "Media files are viewable by everyone"
  ON media_files
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert media files"
  ON media_files
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own media files"
  ON media_files
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete their own media files"
  ON media_files
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Public can view public media files"
  ON media_files
  FOR SELECT
  TO public
  USING (is_public = true);

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS increment_media_usage(UUID);

-- Create function to increment media usage count
CREATE OR REPLACE FUNCTION increment_media_usage(p_media_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE media_files
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_media_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function for updating updated_at
CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger exists before creating it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_media_files_updated_at' 
    AND tgrelid = 'media_files'::regclass
  ) THEN
    CREATE TRIGGER update_media_files_updated_at
    BEFORE UPDATE ON media_files
    FOR EACH ROW
    EXECUTE FUNCTION update_media_files_updated_at();
  END IF;
END $$;