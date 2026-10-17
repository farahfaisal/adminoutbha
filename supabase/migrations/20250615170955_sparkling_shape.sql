-- Create referral_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create referrals table if it doesn't exist
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id),
  referred_id uuid NOT NULL REFERENCES auth.users(id),
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
  user_id uuid NOT NULL REFERENCES auth.users(id),
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('reward', 'referrer_bonus')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DO $$
BEGIN
  -- Drop policies for referral_codes if they exist
  DROP POLICY IF EXISTS "Users can view their own referral codes" ON referral_codes;
  DROP POLICY IF EXISTS "Users can create their own referral codes" ON referral_codes;
  
  -- Drop policies for referrals if they exist
  DROP POLICY IF EXISTS "Users can view their own referrals" ON referrals;
  DROP POLICY IF EXISTS "Anyone can create referrals" ON referrals;
  
  -- Drop policies for referral_transactions if they exist
  DROP POLICY IF EXISTS "Users can view their own referral transactions" ON referral_transactions;
END
$$;

-- Create policies for referral_codes
CREATE POLICY "Users can view their own referral codes"
  ON referral_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own referral codes"
  ON referral_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create policies for referrals
CREATE POLICY "Users can view their own referrals"
  ON referrals
  FOR SELECT
  TO authenticated
  USING ((referrer_id = auth.uid()) OR (referred_id = auth.uid()));

CREATE POLICY "Anyone can create referrals"
  ON referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for referral_transactions
CREATE POLICY "Users can view their own referral transactions"
  ON referral_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS generate_referral_code(text);
DROP FUNCTION IF EXISTS create_user_referral_code(uuid, text, integer, integer, timestamptz);
DROP FUNCTION IF EXISTS process_referral(text, uuid);
DROP FUNCTION IF EXISTS complete_referral(uuid);
DROP FUNCTION IF EXISTS get_user_referral_stats(uuid);
DROP FUNCTION IF EXISTS create_referral_code_for_new_user();

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

-- Create function to process a referral
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code text,
  p_referred_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_code_record referral_codes%ROWTYPE;
  v_referral_id uuid;
  v_result jsonb;
BEGIN
  -- Check if referral code exists and is active
  SELECT * INTO v_code_record
  FROM referral_codes
  WHERE code = p_referral_code AND status = 'active';
  
  IF v_code_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid or inactive referral code'
    );
  END IF;
  
  -- Check if code has expired
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < now() THEN
    -- Update code status to expired
    UPDATE referral_codes
    SET status = 'expired'
    WHERE id = v_code_record.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral code has expired'
    );
  END IF;
  
  -- Check if usage limit has been reached
  IF v_code_record.usage_limit IS NOT NULL AND v_code_record.used_count >= v_code_record.usage_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral code usage limit reached'
    );
  END IF;
  
  -- Check if user is trying to refer themselves
  IF v_code_record.user_id = p_referred_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cannot refer yourself'
    );
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    code_id,
    status
  ) VALUES (
    v_code_record.user_id,
    p_referred_id,
    v_code_record.id,
    'pending'
  ) RETURNING id INTO v_referral_id;
  
  -- Update used count
  UPDATE referral_codes
  SET used_count = used_count + 1
  WHERE id = v_code_record.id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'message', 'Referral processed successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to complete a referral and award points
CREATE OR REPLACE FUNCTION complete_referral(
  p_referral_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_referral referrals%ROWTYPE;
  v_code referral_codes%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Get referral record
  SELECT * INTO v_referral
  FROM referrals
  WHERE id = p_referral_id;
  
  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral not found'
    );
  END IF;
  
  -- Check if referral is already completed
  IF v_referral.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral already completed'
    );
  END IF;
  
  -- Get referral code
  SELECT * INTO v_code
  FROM referral_codes
  WHERE id = v_referral.code_id;
  
  -- Update referral status
  UPDATE referrals
  SET 
    status = 'completed',
    completed_at = now()
  WHERE id = p_referral_id;
  
  -- Create transaction for referred user
  INSERT INTO referral_transactions (
    referral_id,
    user_id,
    points,
    type,
    description
  ) VALUES (
    p_referral_id,
    v_referral.referred_id,
    v_code.points_reward,
    'reward',
    'Reward for using referral code'
  );
  
  -- Create transaction for referrer
  INSERT INTO referral_transactions (
    referral_id,
    user_id,
    points,
    type,
    description
  ) VALUES (
    p_referral_id,
    v_referral.referrer_id,
    v_code.points_referrer,
    'referrer_bonus',
    'Bonus for referring a new user'
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral completed successfully',
    'points_reward', v_code.points_reward,
    'points_referrer', v_code.points_referrer
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user referral stats
CREATE OR REPLACE FUNCTION get_user_referral_stats(
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_total_referrals integer;
  v_completed_referrals integer;
  v_total_points integer;
  v_active_code text;
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
  
  -- Get active referral code
  SELECT code INTO v_active_code
  FROM referral_codes
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Build result
  v_result := jsonb_build_object(
    'total_referrals', v_total_referrals,
    'completed_referrals', v_completed_referrals,
    'total_points', v_total_points,
    'active_code', v_active_code
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to automatically create referral code for new users
CREATE OR REPLACE FUNCTION create_referral_code_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create referral code for new user
  PERFORM create_user_referral_code(
    NEW.id,
    'user',
    100,
    50,
    (CURRENT_DATE + INTERVAL '1 year')::timestamptz
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table
DO $$
BEGIN
  -- Drop trigger if it exists
  DROP TRIGGER IF EXISTS create_referral_code_on_user_creation ON auth.users;
  
  -- Try to create the trigger
  BEGIN
    CREATE TRIGGER create_referral_code_on_user_creation
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_referral_code_for_new_user();
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'Could not create trigger on auth.users table';
  END;
END
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_referral_code(uuid, text, integer, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_referral(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referral_stats(uuid) TO authenticated;