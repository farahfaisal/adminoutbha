/*
  # Fix Referral Trigger - Skip Non-Customers

  1. Changes
    - Update create_referral_code_for_new_user trigger to only run for customers
    - Check if user exists in customers table before creating referral code
    - This prevents errors when creating Super Admins or other non-customer users

  2. Security
    - Maintains existing RLS policies
    - Only creates referral codes for actual customers
*/

-- Update the trigger function to check if user is a customer
CREATE OR REPLACE FUNCTION create_referral_code_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create referral code if user is a customer
  -- Wait a moment and check if customer record exists
  -- This prevents errors for Super Admins and other non-customer users
  IF EXISTS (
    SELECT 1 FROM customers WHERE id = NEW.id
  ) THEN
    -- Create referral code for new customer
    PERFORM create_user_referral_code(
      NEW.id,
      'user',
      100,
      50,
      (CURRENT_DATE + INTERVAL '1 year')::timestamptz
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, no need to recreate it
