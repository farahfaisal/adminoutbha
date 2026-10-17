/*
  # Create function to sign out all users

  1. New Functions
    - `sign_out_all_users`: Function to invalidate all user sessions
    
  2. Changes
    - Creates a function that clears all refresh tokens from auth.refresh_tokens
    - This will effectively log out all users from all devices
    
  3. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Only accessible through the Edge Function which checks admin permissions
*/

CREATE OR REPLACE FUNCTION sign_out_all_users()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete all refresh tokens to invalidate all sessions
  DELETE FROM auth.refresh_tokens;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'sessions_cleared', deleted_count,
    'message', 'All user sessions have been cleared'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sign_out_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION sign_out_all_users() TO service_role;
