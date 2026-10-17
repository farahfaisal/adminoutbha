/*
  # Improve Referral Points System
  
  1. Changes
    - Add function to complete referrals and award points immediately
    - Ensure proper relationships between referrals and points accounts
    - Fix customer information display in referral system
*/

-- Create or replace function to complete a referral and award points immediately
CREATE OR REPLACE FUNCTION complete_customer_referral(
  p_referral_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_code RECORD;
  v_customer_id UUID;
  v_referrer_customer_id UUID;
  v_points_account_id UUID;
  v_referrer_points_account_id UUID;
BEGIN
  -- Get the referral
  SELECT r.*, rc.points_reward, rc.points_referrer, rc.user_id
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
  
  -- Get the customer ID for the referred user
  SELECT id INTO v_customer_id
  FROM customers
  WHERE user_id = v_referral.referred_id;
  
  -- Get the customer ID for the referrer
  SELECT id INTO v_referrer_customer_id
  FROM customers
  WHERE user_id = v_referral.referrer_id;
  
  -- Find or create points account for the referred customer
  IF v_customer_id IS NOT NULL THEN
    SELECT id INTO v_points_account_id
    FROM points_accounts
    WHERE customer_id = v_customer_id;
    
    IF v_points_account_id IS NULL THEN
      -- Create a points account for the customer
      INSERT INTO points_accounts (
        customer_id, 
        balance, 
        total_earned,
        last_activity
      )
      VALUES (
        v_customer_id, 
        v_referral.points_reward, 
        v_referral.points_reward,
        NOW()
      )
      RETURNING id INTO v_points_account_id;
    ELSE
      -- Update existing points account
      UPDATE points_accounts
      SET 
        balance = balance + v_referral.points_reward,
        total_earned = total_earned + v_referral.points_reward,
        last_activity = NOW()
      WHERE id = v_points_account_id;
    END IF;
    
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
      'مكافأة استخدام كود الإحالة',
      p_referral_id
    );
  END IF;
  
  -- Find or create points account for the referrer
  IF v_referrer_customer_id IS NOT NULL THEN
    SELECT id INTO v_referrer_points_account_id
    FROM points_accounts
    WHERE customer_id = v_referrer_customer_id;
    
    IF v_referrer_points_account_id IS NULL THEN
      -- Create a points account for the referrer
      INSERT INTO points_accounts (
        customer_id, 
        balance, 
        total_earned,
        last_activity
      )
      VALUES (
        v_referrer_customer_id, 
        v_referral.points_referrer, 
        v_referral.points_referrer,
        NOW()
      )
      RETURNING id INTO v_referrer_points_account_id;
    ELSE
      -- Update existing points account
      UPDATE points_accounts
      SET 
        balance = balance + v_referral.points_referrer,
        total_earned = total_earned + v_referral.points_referrer,
        last_activity = NOW()
      WHERE id = v_referrer_points_account_id;
    END IF;
    
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
      'مكافأة دعوة صديق',
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
    'referrer_points', v_referral.points_referrer,
    'customer_id', v_customer_id,
    'referrer_customer_id', v_referrer_customer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to process referral with immediate point awarding
CREATE OR REPLACE FUNCTION process_referral_with_points(
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
  v_result JSONB;
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
  
  -- Complete the referral immediately to award points
  v_result := complete_customer_referral(v_referral_id);
  
  -- Return success with combined results
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Referral processed and points awarded successfully',
    'referral_id', v_referral_id,
    'code', p_referral_code,
    'points_awarded', v_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get customer referral details
CREATE OR REPLACE FUNCTION get_customer_referral_details(
  p_customer_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_referral_code RECORD;
  v_points_balance INTEGER;
BEGIN
  -- Get referral code for customer
  SELECT rc.* INTO v_referral_code
  FROM referral_codes rc
  WHERE rc.customer_id = p_customer_id
  ORDER BY rc.created_at DESC
  LIMIT 1;
  
  -- Get points balance
  SELECT balance INTO v_points_balance
  FROM points_accounts
  WHERE customer_id = p_customer_id;
  
  -- Build result
  v_result := jsonb_build_object(
    'customer_id', p_customer_id,
    'points_balance', COALESCE(v_points_balance, 0)
  );
  
  -- Add referral code info if exists
  IF v_referral_code.id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'referral_code', v_referral_code.code,
      'referral_link', v_referral_code.referral_link,
      'points_reward', v_referral_code.points_reward,
      'points_referrer', v_referral_code.points_referrer,
      'status', v_referral_code.status,
      'used_count', v_referral_code.used_count
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_customer_referral(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_with_points(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_referral_details(UUID) TO authenticated;