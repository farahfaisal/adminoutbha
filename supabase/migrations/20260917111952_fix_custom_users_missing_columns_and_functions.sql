/*
# Fix custom_users missing columns and add_custom_user function

1. Modified Tables
- `custom_users`: add `phone` (text), `status` (text default 'active'), `last_login` (timestamptz) columns
  These columns were dropped when the table was recreated by the restore migration,
  but the application code (AddVendor, AddDriver, AddCustomer) inserts them.

2. Functions
- Recreate `add_custom_user(p_username, p_password, p_name, p_email, p_phone, p_role)` SECURITY DEFINER function
  that inserts into custom_users with the `password` column (consistent with the rest of the app).
  Returns the new user's uuid.
- Recreate `change_custom_user_password(p_user_id, p_new_password)` for password changes.

3. Security
- EXECUTE on add_custom_user granted to anon, authenticated (needed for signup flows).
- EXECUTE on change_custom_user_password granted to anon, authenticated.
*/

ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS last_login timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS custom_users_username_key ON public.custom_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS custom_users_email_key ON public.custom_users (lower(email)) WHERE email IS NOT NULL;

DROP FUNCTION IF EXISTS public.add_custom_user(text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.add_custom_user(
  p_username text,
  p_password text,
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'customer'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RAISE EXCEPTION 'Username is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.custom_users (id, username, password, name, email, phone, role, is_active, status)
  VALUES (v_id, lower(trim(p_username)), p_password, p_name, p_email, p_phone, p_role, true, 'active')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_custom_user(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_custom_user(text, text, text, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.change_custom_user_password(uuid, text);
CREATE OR REPLACE FUNCTION public.change_custom_user_password(
  p_user_id uuid,
  p_new_password text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  UPDATE public.custom_users SET password = p_new_password, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.change_custom_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_custom_user_password(uuid, text) TO anon, authenticated;
