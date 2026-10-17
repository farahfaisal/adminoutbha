-- Add UPDATE policy for drivers table
CREATE POLICY "update_drivers" ON drivers
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Add DELETE policy for drivers table
CREATE POLICY "delete_drivers" ON drivers
  FOR DELETE TO anon, authenticated
  USING (true);
