/*
# Restore admin user management functions and seed default admin

1. Purpose
- Recreates the admin user management RPC functions referenced by the administration interface.
- Seeds the default administrator account so the login screen can authenticate.

2. Modified objects
- Adds `created_by` column to `admin_users`.
- Adds a unique constraint on `admin_users.user_id` so `ensure_admin_access` can use ON CONFLICT.
- Creates functions: ensure_admin_access, validate_password_strength, create_admin_user, update_admin_password, list_admin_users, toggle_admin_user_status, delete_admin_user.

3. Security
- All functions are SECURITY DEFINER so they can read and write admin_rows regardless of RLS.
- Execution is granted to anon and authenticated roles for the login and management screens.

4. Important notes
- The default admin account uses the legacy fallback path (username=admin, password_hash=NULL) so the first login accepts admin/admin123.
- Audit and session helpers are called inside exception guards so missing helpers do not break the core flows.
*/

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_user_id_key' AND conrelid = 'public.admin_users'::regclass
  ) THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.admin_users (user_id, created_at)
    VALUES (auth.uid(), now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_password_strength(p_password text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_length integer;
  v_score integer := 0;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  v_length := length(p_password);
  IF v_length < 8 THEN
    v_errors := array_append(v_errors, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  ELSE
    v_score := v_score + 1;
  END IF;
  IF p_password ~ '[A-Z]' THEN v_score := v_score + 1; ELSE v_errors := array_append(v_errors, 'يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)'); END IF;
  IF p_password ~ '[a-z]' THEN v_score := v_score + 1; ELSE v_errors := array_append(v_errors, 'يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)'); END IF;
  IF p_password ~ '[0-9]' THEN v_score := v_score + 1; ELSE v_errors := array_append(v_errors, 'يجب أن تحتوي على رقم واحد على الأقل (0-9)'); END IF;
  IF p_password ~ '[!@#$%^&*(),.?":{}|<>]' THEN v_score := v_score + 1; END IF;
  IF v_length >= 12 THEN v_score := v_score + 1; END IF;
  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'score', v_score,
    'strength', CASE WHEN v_score <= 2 THEN 'ضعيفة' WHEN v_score <= 4 THEN 'متوسطة' WHEN v_score <= 5 THEN 'قوية' ELSE 'قوية جداً' END,
    'errors', COALESCE(v_errors, ARRAY[]::text[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_password_validation jsonb;
  v_existing_user record;
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم مطلوب');
  END IF;
  IF p_password IS NULL OR trim(p_password) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'كلمة المرور مطلوبة');
  END IF;
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'الاسم الكامل مطلوب');
  END IF;

  v_password_validation := public.validate_password_strength(p_password);
  IF NOT (v_password_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'كلمة المرور ضعيفة', 'validation', v_password_validation);
  END IF;

  SELECT * INTO v_existing_user FROM public.admin_users WHERE username = lower(trim(p_username));
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم موجود مسبقاً');
  END IF;

  v_user_id := gen_random_uuid();
  INSERT INTO public.admin_users (id, user_id, username, password_hash, full_name, email, is_active, created_by, created_at)
  VALUES (
    v_user_id, v_user_id, lower(trim(p_username)), crypt(p_password, gen_salt('bf', 10)),
    trim(p_full_name), CASE WHEN p_email IS NOT NULL THEN lower(trim(p_email)) ELSE NULL END,
    true, p_created_by, now()
  );

  BEGIN
    PERFORM public.log_audit_event(p_created_by, 'create_admin_user', 'admin_users', v_user_id, NULL,
      jsonb_build_object('username', p_username, 'full_name', p_full_name, 'email', p_email), NULL, NULL, 'warning');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'username', lower(trim(p_username)),
    'message', 'تم إنشاء المستخدم بنجاح', 'password_strength', v_password_validation->>'strength');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_password(
  p_username text,
  p_old_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_password_validation jsonb;
BEGIN
  SELECT * INTO v_user FROM public.admin_users WHERE username = lower(trim(p_username)) AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود أو غير نشط');
  END IF;

  IF v_user.password_hash IS NOT NULL THEN
    IF NOT (v_user.password_hash = crypt(p_old_password, v_user.password_hash)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'كلمة المرور القديمة غير صحيحة');
    END IF;
  END IF;

  v_password_validation := public.validate_password_strength(p_new_password);
  IF NOT (v_password_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'كلمة المرور الجديدة ضعيفة', 'validation', v_password_validation);
  END IF;

  UPDATE public.admin_users SET password_hash = crypt(p_new_password, gen_salt('bf', 10)), updated_at = now()
  WHERE username = lower(trim(p_username));

  BEGIN
    PERFORM public.end_all_user_sessions(v_user.user_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث كلمة المرور بنجاح',
    'password_strength', v_password_validation->>'strength');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_password(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_super record;
BEGIN
  SELECT * INTO v_user FROM public.admin_users
  WHERE lower(coalesce(username, '')) = lower(trim(p_username)) AND is_active = true
  LIMIT 1;

  IF v_user.id IS NOT NULL THEN
    IF v_user.password_hash IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
      UPDATE public.admin_users SET last_login = now(), updated_at = now() WHERE id = v_user.id;
      RETURN jsonb_build_object('success', true, 'user_id', v_user.user_id, 'username', v_user.username,
        'full_name', coalesce(v_user.full_name, v_user.name, v_user.username), 'email', v_user.email, 'is_super_admin', false);
    END IF;

    IF v_user.password_hash IS NULL AND lower(trim(p_username)) = 'admin' AND p_password = 'admin123' THEN
      UPDATE public.admin_users SET last_login = now(), updated_at = now() WHERE id = v_user.id;
      RETURN jsonb_build_object('success', true, 'user_id', v_user.user_id, 'username', v_user.username,
        'full_name', coalesce(v_user.full_name, v_user.name, v_user.username), 'email', v_user.email,
        'is_super_admin', false, 'warning', 'يرجى تغيير كلمة المرور الافتراضية');
    END IF;
  END IF;

  SELECT * INTO v_super FROM public.super_admins
  WHERE lower(email) = lower(trim(p_username)) AND status = 'active'
  LIMIT 1;

  IF v_super.id IS NOT NULL AND v_super.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = v_super.user_id AND u.encrypted_password = crypt(p_password, u.encrypted_password)
  ) THEN
    UPDATE public.super_admins SET last_login = now() WHERE id = v_super.id;
    RETURN jsonb_build_object('success', true, 'user_id', v_super.user_id, 'username', v_super.email,
      'full_name', v_super.email, 'email', v_super.email, 'is_super_admin', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  email text,
  is_active boolean,
  last_login timestamptz,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.username, a.full_name, a.email, a.is_active, a.last_login, a.created_at, a.created_by
  FROM public.admin_users a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_admin_user_status(
  p_username text,
  p_is_active boolean,
  p_updated_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.admin_users WHERE username = lower(trim(p_username));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  UPDATE public.admin_users SET is_active = p_is_active, updated_at = now() WHERE username = lower(trim(p_username));

  IF NOT p_is_active THEN
    BEGIN PERFORM public.end_all_user_sessions(v_user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  BEGIN
    PERFORM public.log_audit_event(p_updated_by, CASE WHEN p_is_active THEN 'activate_user' ELSE 'deactivate_user' END,
      'admin_users', v_user_id, NULL, jsonb_build_object('username', p_username, 'is_active', p_is_active), NULL, NULL, 'warning');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'message', CASE WHEN p_is_active THEN 'تم تفعيل المستخدم' ELSE 'تم تعطيل المستخدم' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_user(
  p_username text,
  p_deleted_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF (SELECT COUNT(*) FROM public.admin_users WHERE is_active = true) <= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن حذف آخر مستخدم نشط');
  END IF;

  SELECT user_id INTO v_user_id FROM public.admin_users WHERE username = lower(trim(p_username));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  BEGIN PERFORM public.end_all_user_sessions(v_user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  DELETE FROM public.admin_users WHERE username = lower(trim(p_username));

  BEGIN
    PERFORM public.log_audit_event(p_deleted_by, 'delete_admin_user', 'admin_users', v_user_id,
      jsonb_build_object('username', p_username), NULL, NULL, NULL, 'critical');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف المستخدم بنجاح');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_admin_access() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_strength(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_password(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_admin_user_status(text, boolean, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_admin_user(text, uuid) TO anon, authenticated;

INSERT INTO public.admin_users (id, user_id, username, password_hash, full_name, name, email, role, is_active, created_at)
SELECT gen_random_uuid(), gen_random_uuid(), 'admin', NULL, 'مدير النظام', 'مدير النظام', 'admin@atlbha.com', 'admin', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.admin_users WHERE username = 'admin');
