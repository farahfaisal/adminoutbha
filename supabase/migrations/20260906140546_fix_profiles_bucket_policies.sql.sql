/*
# Fix missing profiles bucket policies and ensure all buckets have proper policies

1. Security
- Add missing UPDATE and DELETE policies for profiles bucket
- Ensure all buckets have complete CRUD policies
*/

-- Add missing profiles UPDATE and DELETE policies
DROP POLICY IF EXISTS "profiles_bucket_update" ON storage.objects;
CREATE POLICY "profiles_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'profiles') WITH CHECK (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profiles_bucket_delete" ON storage.objects;
CREATE POLICY "profiles_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'profiles');
