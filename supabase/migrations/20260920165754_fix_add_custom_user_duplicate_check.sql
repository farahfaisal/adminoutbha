/*
# Fix add_custom_user to check duplicates with clear errors

1. Functions
- Recreate `add_custom_user` to check for existing username/email/phone BEFORE inserting,
  raising clear Arabic error messages so the frontend can display them properly.
- Also handle the case where the phone is already registered but has no vendor linked.
*/

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
  v_existing_username text;
  v_existing_email text;
  v_existing_phone text;
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RAISE EXCEPTION 'اسم المستخدم مطلوب';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  END IF;

  SELECT username INTO v_existing_username FROM public.custom_users WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
  IF v_existing_username IS NOT NULL THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    SELECT email INTO v_existing_email FROM public.custom_users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
    IF v_existing_email IS NOT NULL THEN
      RAISE EXCEPTION 'البريد الإلكتروني مستخدم بالفعل';
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND trim(p_phone) <> '' THEN
    SELECT phone INTO v_existing_phone FROM public.custom_users WHERE phone = trim(p_phone) LIMIT 1;
    IF v_existing_phone IS NOT NULL THEN
      RAISE EXCEPTION 'رقم الهاتف مستخدم بالفعل';
    END IF;
  END IF;

  INSERT INTO public.custom_users (id, username, password, name, email, phone, role, is_active, status)
  VALUES (v_id, lower(trim(p_username)), p_password, p_name, p_email, p_phone, p_role, true, 'active')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_custom_user(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_custom_user(text, text, text, text, text, text) TO anon, authenticated;
