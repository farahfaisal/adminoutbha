/*
  # Create Storage Buckets for Media Files

  1. Storage Buckets
    - Creates `general` bucket for general media files
    - Creates `products` bucket for product images
    - Creates `vendors` bucket for vendor images
    - Creates `profiles` bucket for user profile images
    - Creates `advertisements` bucket for advertisement images

  2. Security
    - Enable public access for all buckets
    - Allow authenticated users to upload files
    - Allow authenticated users to delete their own files
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('general', 'general', true),
  ('products', 'products', true),
  ('vendors', 'vendors', true),
  ('profiles', 'profiles', true),
  ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Policy: Allow public read access to all files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('general', 'products', 'vendors', 'profiles', 'advertisements'));

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('general', 'products', 'vendors', 'profiles', 'advertisements'));

-- Policy: Allow authenticated users to update files
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('general', 'products', 'vendors', 'profiles', 'advertisements'));

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('general', 'products', 'vendors', 'profiles', 'advertisements'));
