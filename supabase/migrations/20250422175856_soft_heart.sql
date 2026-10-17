/*
  # Create Storage Buckets

  1. New Storage Buckets
    - `products` - For product images
    - `vendors` - For vendor logos and banners
    - `profiles` - For user profile images
    - `advertisements` - For advertisement images
    - `general` - For general media files

  2. Security
    - Add public read access policies for all buckets
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('vendors', 'vendors', true),
  ('profiles', 'profiles', true),
  ('advertisements', 'advertisements', true),
  ('general', 'general', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for public access
CREATE POLICY "Public Read Access for products"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

CREATE POLICY "Public Read Access for vendors"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vendors');

CREATE POLICY "Public Read Access for profiles"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');

CREATE POLICY "Public Read Access for advertisements"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'advertisements');

CREATE POLICY "Public Read Access for general"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'general');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload to vendors"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vendors');

CREATE POLICY "Authenticated users can upload to profiles"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles');

CREATE POLICY "Authenticated users can upload to advertisements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'advertisements');

CREATE POLICY "Authenticated users can upload to general"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'general');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner);

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);