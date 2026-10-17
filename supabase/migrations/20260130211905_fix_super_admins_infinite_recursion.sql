/*
  # Fix Super Admins Infinite Recursion
  
  1. Changes
    - Remove recursive policies on super_admins table
    - Use simpler policies that don't reference super_admins within super_admins queries
    - Allow authenticated users to view their own record
    - Use service role for management operations
  
  2. Security
    - Users can only see their own super_admin record
    - Management operations handled via service role or functions
*/

-- Drop all existing policies on super_admins
DROP POLICY IF EXISTS "Super admins can view all super admin records" ON super_admins;
DROP POLICY IF EXISTS "Users can view their own super admin record" ON super_admins;
DROP POLICY IF EXISTS "Super admins can create new super admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins can update super admin data" ON super_admins;
DROP POLICY IF EXISTS "Super admins can delete super admins" ON super_admins;
DROP POLICY IF EXISTS "Service role can insert super admins" ON super_admins;

-- Create simple, non-recursive policies
-- Allow users to view their own super admin record (no recursion)
CREATE POLICY "Users can view own super admin record"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (bypasses RLS anyway, but explicit is good)
CREATE POLICY "Service role full access"
  ON super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
