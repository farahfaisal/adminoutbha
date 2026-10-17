/*
  # Fix Super Admins SELECT Policy

  1. Changes
    - Drop the existing restrictive SELECT policy
    - Create a new policy that allows authenticated users to view their own super admin record
    - This fixes the circular dependency issue during login

  2. Security
    - Users can only see their own super admin record (user_id = auth.uid())
    - This is safe because they need to be authenticated first
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Super admins can view all super admin data" ON super_admins;

-- Create a new policy that allows users to view their own record
CREATE POLICY "Users can view their own super admin record"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add a separate policy for super admins to view all records
CREATE POLICY "Super admins can view all super admin records"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
      AND sa.status = 'active'
      AND (sa.permissions->>'all')::boolean = true
    )
  );
