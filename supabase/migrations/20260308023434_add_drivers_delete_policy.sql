/*
  # Add DELETE policy for drivers table

  1. Changes
    - Add DELETE policy allowing admins and super admins to delete drivers
    - Add DELETE policy allowing service area managers to delete drivers in their areas

  2. Security
    - Only authenticated admins can delete any driver
    - Service area managers can only delete drivers in their assigned areas
*/

-- Allow admins and super admins to delete drivers
CREATE POLICY "Admins can delete drivers"
  ON drivers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- Allow service area managers to delete drivers in their areas
CREATE POLICY "Service area managers can delete drivers in their areas"
  ON drivers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM service_area_managers sam
      JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
      WHERE sam.user_id = auth.uid()
        AND sama.service_area_id = drivers.service_area_id
        AND sam.status = 'active'
    )
  );
