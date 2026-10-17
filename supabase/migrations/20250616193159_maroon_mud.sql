/*
  # Add Referral Link to Referral Codes Table
  
  1. Changes
    - Add `referral_link` column to `referral_codes` table
    - Update functions to generate and store referral links
    - Ensure existing referral codes get a link
*/

-- Add referral_link column to referral_codes table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referral_codes' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE referral_codes ADD COLUMN referral_link text;
  END IF;
END $$;

-- Update existing referral codes to have a referral link
UPDATE referral_codes
SET referral_link = 'https://ben-edek.com/signup?ref=' || code
WHERE referral_link IS NULL;

-- Update the create_user_referral_code function to include referral_link
CREATE OR REPLACE FUNCTION create_user_referral_code(
  p_user_id uuid,
  p_type text DEFAULT 'user',
  p_points_reward integer DEFAULT 100,
  p_points_referrer integer DEFAULT 50,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_code text;
  v_result jsonb;
  v_code_id uuid;
  v_referral_link text;
BEGIN
  -- Check if user already has a referral code
  IF EXISTS(
    SELECT 1 FROM referral_codes WHERE user_id = p_user_id AND type = p_type AND status = 'active'
  ) THEN
    SELECT jsonb_build_object(
      'success', false,
      'message', 'User already has an active referral code',
      'code', code,
      'referral_link', referral_link
    ) INTO v_result
    FROM referral_codes
    WHERE user_id = p_user_id AND type = p_type AND status = 'active';
    
    RETURN v_result;
  END IF;
  
  -- Generate a unique referral code
  v_code := generate_referral_code(
    CASE 
      WHEN p_type = 'influencer' THEN 'INF'
      ELSE ''
    END
  );
  
  -- Generate referral link
  v_referral_link := 'https://ben-edek.com/signup?ref=' || v_code;
  
  -- Create referral code
  INSERT INTO referral_codes (
    user_id,
    code,
    type,
    status,
    points_reward,
    points_referrer,
    expires_at,
    referral_link
  ) VALUES (
    p_user_id,
    v_code,
    p_type,
    'active',
    p_points_reward,
    p_points_referrer,
    p_expires_at,
    v_referral_link
  ) RETURNING id INTO v_code_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'code_id', v_code_id,
    'code', v_code,
    'referral_link', v_referral_link,
    'message', 'Referral code created successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_user_referral_stats function to include referral_link
CREATE OR REPLACE FUNCTION get_user_referral_stats(
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_total_referrals integer;
  v_completed_referrals integer;
  v_total_points integer;
  v_active_code text;
  v_referral_link text;
  v_result jsonb;
BEGIN
  -- Get total referrals
  SELECT COUNT(*) INTO v_total_referrals
  FROM referrals
  WHERE referrer_id = p_user_id;
  
  -- Get completed referrals
  SELECT COUNT(*) INTO v_completed_referrals
  FROM referrals
  WHERE referrer_id = p_user_id AND status = 'completed';
  
  -- Get total points earned from referrals
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM referral_transactions
  WHERE user_id = p_user_id AND type = 'referrer_bonus';
  
  -- Get active referral code and link
  SELECT code, referral_link INTO v_active_code, v_referral_link
  FROM referral_codes
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Build result
  v_result := jsonb_build_object(
    'total_referrals', v_total_referrals,
    'completed_referrals', v_completed_referrals,
    'total_points', v_total_points,
    'active_code', v_active_code,
    'referral_link', v_referral_link
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_user_referral_code(uuid, text, integer, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referral_stats(uuid) TO authenticated;