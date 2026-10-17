-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('vendors', 'vendors', true),
  ('profiles', 'profiles', true),
  ('advertisements', 'advertisements', true),
  ('general', 'general', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for public access with IF NOT EXISTS
DO $$
BEGIN
  -- Public Read Access policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Read Access for products'
  ) THEN
    CREATE POLICY "Public Read Access for products"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'products');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Read Access for vendors'
  ) THEN
    CREATE POLICY "Public Read Access for vendors"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'vendors');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Read Access for profiles'
  ) THEN
    CREATE POLICY "Public Read Access for profiles"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'profiles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Read Access for advertisements'
  ) THEN
    CREATE POLICY "Public Read Access for advertisements"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'advertisements');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Read Access for general'
  ) THEN
    CREATE POLICY "Public Read Access for general"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'general');
  END IF;

  -- Upload policies for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to products'
  ) THEN
    CREATE POLICY "Authenticated users can upload to products"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'products');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to vendors'
  ) THEN
    CREATE POLICY "Authenticated users can upload to vendors"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vendors');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to profiles'
  ) THEN
    CREATE POLICY "Authenticated users can upload to profiles"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'profiles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to advertisements'
  ) THEN
    CREATE POLICY "Authenticated users can upload to advertisements"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'advertisements');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to general'
  ) THEN
    CREATE POLICY "Authenticated users can upload to general"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'general');
  END IF;

  -- Update and delete policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can update their own files'
  ) THEN
    CREATE POLICY "Authenticated users can update their own files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can delete their own files'
  ) THEN
    CREATE POLICY "Authenticated users can delete their own files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (auth.uid() = owner);
  END IF;
END $$;