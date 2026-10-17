-- Allow anonymous (pre-login) callers to invoke verify_admin_password
-- The login page runs before the user is authenticated, so it uses the anon key.
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text, text) TO anon;