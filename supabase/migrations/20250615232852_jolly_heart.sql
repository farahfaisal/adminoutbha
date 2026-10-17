/*
  # Fix Referral Code Generation
  
  1. Changes
    - Add function to generate customer referral code
    - Create trigger to automatically generate referral code for new customers
    - Fix relationship between customers and referral codes
*/

-- Add customer_id column to referral_codes table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referral_codes' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE referral_codes ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create function to generate customer referral code
CREATE OR REPLACE FUNCTION generate_customer_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_code_id UUID;
  v_user_id UUID;
BEGIN
  -- Get user_id from the customer
  v_user_id := NEW.user_id;
  
  -- If no user_id, skip
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Generate a random code
  v_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || RANDOM()::TEXT) FROM 1 FOR 8));
  
  -- Insert the code into referral_codes table
  INSERT INTO referral_codes (
    code, 
    user_id, 
    customer_id, 
    type, 
    status, 
    points_reward, 
    points_referrer
  ) VALUES (
    v_code,
    v_user_id,
    NEW.id,
    'user',
    'active',
    100,
    50
  ) RETURNING id INTO v_code_id;
  
  -- Update the customer with the referral code ID
  UPDATE customers SET referral_code = v_code_id WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to generate referral code when customer is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'generate_customer_referral_code_trigger'
  ) THEN
    CREATE TRIGGER generate_customer_referral_code_trigger
    AFTER INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION generate_customer_referral_code();
  END IF;
END $$;

-- Create function to get user referral code
CREATE OR REPLACE FUNCTION get_user_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Try to get code from referral_codes table directly
  SELECT code INTO v_code
  FROM referral_codes
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If not found, try to get through customer relationship
  IF v_code IS NULL THEN
    SELECT rc.code INTO v_code
    FROM customers c
    JOIN referral_codes rc ON c.referral_code = rc.id
    WHERE c.user_id = p_user_id
    LIMIT 1;
  END IF;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_referral_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referral_code(UUID) TO anon;