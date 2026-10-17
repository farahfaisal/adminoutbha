/*
  # Fix Service Area Managers Insert Policy Properly
  
  1. Changes
    - Remove unsafe anon policy
    - Fix authenticated policy to work with service_role
    - Service role should bypass RLS automatically in Supabase
  
  2. Security
    - Only admins and service_role can create managers
    - Users can only insert their own records
*/

-- Remove the unsafe anon policy
DROP POLICY IF EXISTS "Allow service role to insert managers" ON service_area_managers;

-- The service_role should bypass RLS automatically
-- But let's make sure the authenticated policy is correct
DROP POLICY IF EXISTS "Allow insert for admins, self, and service role" ON service_area_managers;

-- Create a proper insert policy
CREATE POLICY "Allow insert for admins and self"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin users can insert
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
    OR
    -- Users can insert their own record
    auth.uid() = user_id
  );