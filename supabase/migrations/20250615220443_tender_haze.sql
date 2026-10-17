/*
  # Create relationship between referral codes and customers

  1. New Columns
    - Add `customer_id` to `referral_codes` table to link codes to customers
    - Add `referral_code` to `customers` table to track which code was used for signup
  
  2. Foreign Keys
    - Create foreign key from `referral_codes.customer_id` to `customers.id`
    - Create foreign key from `customers.referral_code` to `referral_codes.id`
  
  3. Functions
    - Update functions to handle the new relationships
*/

-- Add customer_id column to referral_codes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_codes' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE referral_codes ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Add referral_code column to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE customers ADD COLUMN referral_code uuid REFERENCES referral_codes(id);
  END IF;
END $$;

-- Create function to generate referral code for customer
CREATE OR REPLACE FUNCTION generate_customer_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_code_id UUID;
BEGIN
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
    NEW.user_id,
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

-- Create function to process referral when customer uses a code
CREATE OR REPLACE FUNCTION process_customer_referral(
  p_customer_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referral_code_id UUID;
  v_referrer_id UUID;
  v_referral_id UUID;
  v_points_reward INTEGER;
  v_points_referrer INTEGER;
BEGIN
  -- Find the referral code
  SELECT id, user_id, points_reward, points_referrer
  INTO v_referral_code_id, v_referrer_id, v_points_reward, v_points_referrer
  FROM referral_codes
  WHERE code = p_referral_code AND status = 'active';
  
  IF v_referral_code_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Invalid or inactive referral code'
    );
  END IF;
  
  -- Update the customer with the referral code
  UPDATE customers 
  SET referral_code = v_referral_code_id
  WHERE id = p_customer_id;
  
  -- Create a referral record
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    code_id,
    status
  ) VALUES (
    v_referrer_id,
    p_customer_id,
    v_referral_code_id,
    'pending'
  ) RETURNING id INTO v_referral_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'referral_id', v_referral_id,
    'points_reward', v_points_reward,
    'points_referrer', v_points_referrer
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to complete a referral and award points
CREATE OR REPLACE FUNCTION complete_customer_referral(
  p_referral_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_code RECORD;
  v_customer_id UUID;
  v_referrer_id UUID;
  v_points_account_id UUID;
  v_referrer_points_account_id UUID;
BEGIN
  -- Get the referral
  SELECT r.*, rc.points_reward, rc.points_referrer
  INTO v_referral
  FROM referrals r
  JOIN referral_codes rc ON r.code_id = rc.id
  WHERE r.id = p_referral_id;
  
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Referral not found'
    );
  END IF;
  
  IF v_referral.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Referral is not in pending status'
    );
  END IF;
  
  -- Get the customer ID from the referral
  v_customer_id := v_referral.referred_id;
  v_referrer_id := v_referral.referrer_id;
  
  -- Find or create points account for the customer
  SELECT id INTO v_points_account_id
  FROM points_accounts
  WHERE customer_id = v_customer_id;
  
  IF v_points_account_id IS NULL THEN
    -- Create a points account for the customer
    INSERT INTO points_accounts (customer_id, balance, total_earned)
    VALUES (v_customer_id, v_referral.points_reward, v_referral.points_reward)
    RETURNING id INTO v_points_account_id;
    
    -- Add points transaction
    INSERT INTO points_transactions (
      account_id,
      amount,
      type,
      description,
      reference_id
    ) VALUES (
      v_points_account_id,
      v_referral.points_reward,
      'earn',
      'Referral bonus',
      p_referral_id
    );
  ELSE
    -- Update existing points account
    UPDATE points_accounts
    SET 
      balance = balance + v_referral.points_reward,
      total_earned = total_earned + v_referral.points_reward,
      last_activity = NOW()
    WHERE id = v_points_account_id;
    
    -- Add points transaction
    INSERT INTO points_transactions (
      account_id,
      amount,
      type,
      description,
      reference_id
    ) VALUES (
      v_points_account_id,
      v_referral.points_reward,
      'earn',
      'Referral bonus',
      p_referral_id
    );
  END IF;
  
  -- Find or create points account for the referrer
  SELECT id INTO v_referrer_points_account_id
  FROM points_accounts
  WHERE customer_id = (
    SELECT id FROM customers WHERE user_id = v_referrer_id
  );
  
  IF v_referrer_points_account_id IS NOT NULL THEN
    -- Update referrer's points account
    UPDATE points_accounts
    SET 
      balance = balance + v_referral.points_referrer,
      total_earned = total_earned + v_referral.points_referrer,
      last_activity = NOW()
    WHERE id = v_referrer_points_account_id;
    
    -- Add points transaction for referrer
    INSERT INTO points_transactions (
      account_id,
      amount,
      type,
      description,
      reference_id
    ) VALUES (
      v_referrer_points_account_id,
      v_referral.points_referrer,
      'earn',
      'Referral bonus for inviting a friend',
      p_referral_id
    );
  END IF;
  
  -- Update referral status
  UPDATE referrals
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_referral_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'customer_points', v_referral.points_reward,
    'referrer_points', v_referral.points_referrer
  );
END;
$$ LANGUAGE plpgsql;

-- Update the process_referral function to handle customer relationships
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code TEXT,
  p_referred_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_code_id UUID;
  v_referrer_id UUID;
  v_referral_id UUID;
  v_customer_id UUID;
  v_already_referred BOOLEAN;
BEGIN
  -- Check if the referral code exists and is active
  SELECT id, user_id INTO v_code_id, v_referrer_id
  FROM referral_codes
  WHERE code = p_referral_code AND status = 'active';
  
  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Invalid or inactive referral code'
    );
  END IF;
  
  -- Check if the user is trying to refer themselves
  IF v_referrer_id = p_referred_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'You cannot refer yourself'
    );
  END IF;
  
  -- Check if the user has already been referred
  SELECT EXISTS (
    SELECT 1 FROM referrals WHERE referred_id = p_referred_id
  ) INTO v_already_referred;
  
  IF v_already_referred THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'User has already been referred'
    );
  END IF;
  
  -- Find customer ID for the referred user
  SELECT id INTO v_customer_id
  FROM customers
  WHERE user_id = p_referred_id;
  
  -- Create the referral
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    code_id,
    status
  ) VALUES (
    v_referrer_id,
    p_referred_id,
    v_code_id,
    'pending'
  ) RETURNING id INTO v_referral_id;
  
  -- If customer exists, update their referral code
  IF v_customer_id IS NOT NULL THEN
    UPDATE customers
    SET referral_code = v_code_id
    WHERE id = v_customer_id;
  END IF;
  
  -- Increment the used count for the referral code
  UPDATE referral_codes
  SET used_count = used_count + 1
  WHERE id = v_code_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Referral processed successfully',
    'referral_id', v_referral_id,
    'code', p_referral_code
  );
END;
$$ LANGUAGE plpgsql;