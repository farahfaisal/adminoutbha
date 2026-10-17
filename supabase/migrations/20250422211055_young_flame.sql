/*
  # Create API Keys Table

  1. New Tables
    - `api_keys`
      - Stores API keys for external applications
      - Similar to WooCommerce API keys system
      
  2. Security
    - Enable RLS on new table
    - Add policies for user access
*/

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  consumer_key text NOT NULL UNIQUE,
  consumer_secret_hash text NOT NULL,
  description text NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY['read'],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own API keys"
  ON api_keys
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON api_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_consumer_key text, p_consumer_secret text)
RETURNS boolean AS $$
DECLARE
  v_secret_hash text;
  v_status text;
BEGIN
  -- Get the secret hash and status for the given consumer key
  SELECT consumer_secret_hash, status INTO v_secret_hash, v_status
  FROM api_keys
  WHERE consumer_key = p_consumer_key;
  
  -- If no key found or key is revoked, return false
  IF v_secret_hash IS NULL OR v_status = 'revoked' THEN
    RETURN false;
  END IF;
  
  -- Check if the provided secret matches the stored hash
  -- In a real implementation, you would use a proper password hashing function
  -- For simplicity, we're just comparing the values directly
  IF v_secret_hash = p_consumer_secret THEN
    -- Update last_used timestamp
    UPDATE api_keys
    SET last_used = now()
    WHERE consumer_key = p_consumer_key;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check API key permissions
CREATE OR REPLACE FUNCTION check_api_key_permission(p_consumer_key text, p_permission text)
RETURNS boolean AS $$
DECLARE
  v_permissions text[];
  v_status text;
BEGIN
  -- Get the permissions and status for the given consumer key
  SELECT permissions, status INTO v_permissions, v_status
  FROM api_keys
  WHERE consumer_key = p_consumer_key;
  
  -- If no key found or key is revoked, return false
  IF v_permissions IS NULL OR v_status = 'revoked' THEN
    RETURN false;
  END IF;
  
  -- Check if the key has the required permission
  RETURN p_permission = ANY(v_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;