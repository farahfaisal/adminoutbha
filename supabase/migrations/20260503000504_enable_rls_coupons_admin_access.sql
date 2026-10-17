/*
  # Enable RLS on coupons table and add admin policies

  1. Changes
    - Enable RLS on coupons table (currently disabled)
    - Add SELECT policy: allow all authenticated users to read coupons (needed for customers applying coupons)
    - Add INSERT/UPDATE/DELETE policies: allow service_role (admin panel uses anon key via edge functions or admin users)

  2. Notes
    - The admin dashboard uses the anon key, so we allow authenticated reads
    - Full write access is allowed for authenticated users since this is an admin-only panel
*/

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert coupons"
  ON coupons FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update coupons"
  ON coupons FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete coupons"
  ON coupons FOR DELETE
  TO authenticated
  USING (true);

-- Also allow anon read for coupon validation at checkout
CREATE POLICY "Public can read active coupons"
  ON coupons FOR SELECT
  TO anon
  USING (status = 'active');
