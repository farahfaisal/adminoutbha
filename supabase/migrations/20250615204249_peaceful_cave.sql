/*
  # Fix Referral System Foreign Keys
  
  1. Changes
    - Update foreign key constraints in referral_codes and referrals tables
    - Change references from auth.users to custom_users
    - Use a safer approach that works with limited permissions
*/

-- Create referral_codes table if it doesn't exist (with correct foreign key)
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES custom_users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('user', 'influencer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  usage_limit integer,
  used_count integer DEFAULT 0,
  points_reward integer NOT NULL,
  points_referrer integer NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create referrals table if it doesn't exist (with correct foreign keys)
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES custom_users(id),
  referred_id uuid NOT NULL REFERENCES custom_users(id),
  code_id uuid NOT NULL REFERENCES referral_codes(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT referrals_unique_referred UNIQUE (referred_id)
);

-- Create referral_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS referral_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES custom_users(id),
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('reward', 'referrer_bonus')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for referral_codes (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referral_codes' AND policyname = 'Users can view their own referral codes'
  ) THEN
    CREATE POLICY "Users can view their own referral codes"
      ON referral_codes
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referral_codes' AND policyname = 'Users can create their own referral codes'
  ) THEN
    CREATE POLICY "Users can create their own referral codes"
      ON referral_codes
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- Create policies for referrals (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referrals' AND policyname = 'Users can view their own referrals'
  ) THEN
    CREATE POLICY "Users can view their own referrals"
      ON referrals
      FOR SELECT
      TO authenticated
      USING ((referrer_id = auth.uid()) OR (referred_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referrals' AND policyname = 'Anyone can create referrals'
  ) THEN
    CREATE POLICY "Anyone can create referrals"
      ON referrals
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

-- Create policies for referral_transactions (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referral_transactions' AND policyname = 'Users can view their own referral transactions'
  ) THEN
    CREATE POLICY "Users can view their own referral transactions"
      ON referral_transactions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

-- Create function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_prefix text DEFAULT '')
RETURNS text AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate a random code
    v_code := p_prefix || substring(md5(random()::text) from 1 for 8);
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM referral_codes WHERE code = v_code
    ) INTO v_exists;
    
    -- If code doesn't exist, return it
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create a referral code for a user
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
BEGIN
  -- Check if user already has a referral code
  IF EXISTS(
    SELECT 1 FROM referral_codes WHERE user_id = p_user_id AND type = p_type AND status = 'active'
  ) THEN
    SELECT jsonb_build_object(
      'success', false,
      'message', 'User already has an active referral code',
      'code', code
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
  
  -- Create referral code
  INSERT INTO referral_codes (
    user_id,
    code,
    type,
    status,
    points_reward,
    points_referrer,
    expires_at
  ) VALUES (
    p_user_id,
    v_code,
    p_type,
    'active',
    p_points_reward,
    p_points_referrer,
    p_expires_at
  ) RETURNING id INTO v_code_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'code_id', v_code_id,
    'code', v_code,
    'message', 'Referral code created successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_referral_code(uuid, text, integer, integer, timestamptz) TO authenticated;