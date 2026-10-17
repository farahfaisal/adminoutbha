/*
  # Fix Referral Points System

  1. Changes
    - Update the complete_customer_referral function to properly handle customer relationships
    - Ensure points are correctly awarded to both the referred customer and the referrer
    - Fix the relationship between users, customers, and points accounts
*/

-- Create or replace function to complete a referral and award points
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_customer_referral(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_customer_referral(UUID) TO anon;