/*
# Add storage policies for all buckets

1. Security
- Allow anon and authenticated to read (SELECT) from all buckets (public buckets)
- Allow authenticated to insert (upload) to all buckets
- Allow authenticated to update files in all buckets
- Allow authenticated to delete files in all buckets
*/

-- SELECT (read) policies for public access
DROP POLICY IF EXISTS "general_bucket_read" ON storage.objects;
CREATE POLICY "general_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'general');

DROP POLICY IF EXISTS "products_bucket_read" ON storage.objects;
CREATE POLICY "products_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "vendors_bucket_read" ON storage.objects;
CREATE POLICY "vendors_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vendors');

DROP POLICY IF EXISTS "profiles_bucket_read" ON storage.objects;
CREATE POLICY "profiles_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "advertisements_bucket_read" ON storage.objects;
CREATE POLICY "advertisements_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'advertisements');

DROP POLICY IF EXISTS "addons_bucket_read" ON storage.objects;
CREATE POLICY "addons_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'addons');

-- INSERT (upload) policies
DROP POLICY IF EXISTS "general_bucket_insert" ON storage.objects;
CREATE POLICY "general_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'general');

DROP POLICY IF EXISTS "products_bucket_insert" ON storage.objects;
CREATE POLICY "products_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "vendors_bucket_insert" ON storage.objects;
CREATE POLICY "vendors_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'vendors');

DROP POLICY IF EXISTS "profiles_bucket_insert" ON storage.objects;
CREATE POLICY "profiles_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'profiles');

DROP POLICY IF EXISTS "advertisements_bucket_insert" ON storage.objects;
CREATE POLICY "advertisements_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'advertisements');

DROP POLICY IF EXISTS "addons_bucket_insert" ON storage.objects;
CREATE POLICY "addons_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'addons');

-- UPDATE policies
DROP POLICY IF EXISTS "general_bucket_update" ON storage.objects;
CREATE POLICY "general_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'general') WITH CHECK (bucket_id = 'general');

DROP POLICY IF EXISTS "products_bucket_update" ON storage.objects;
CREATE POLICY "products_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'products') WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "vendors_bucket_update" ON storage.objects;
CREATE POLICY "vendors_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'vendors') WITH CHECK (bucket_id = 'vendors');

DROP POLICY IF EXISTS "advertisements_bucket_update" ON storage.objects;
CREATE POLICY "advertisements_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'advertisements') WITH CHECK (bucket_id = 'advertisements');

DROP POLICY IF EXISTS "addons_bucket_update" ON storage.objects;
CREATE POLICY "addons_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'addons') WITH CHECK (bucket_id = 'addons');

-- DELETE policies
DROP POLICY IF EXISTS "general_bucket_delete" ON storage.objects;
CREATE POLICY "general_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'general');

DROP POLICY IF EXISTS "products_bucket_delete" ON storage.objects;
CREATE POLICY "products_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "vendors_bucket_delete" ON storage.objects;
CREATE POLICY "vendors_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'vendors');

DROP POLICY IF EXISTS "advertisements_bucket_delete" ON storage.objects;
CREATE POLICY "advertisements_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'advertisements');

DROP POLICY IF EXISTS "addons_bucket_delete" ON storage.objects;
CREATE POLICY "addons_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'addons');
