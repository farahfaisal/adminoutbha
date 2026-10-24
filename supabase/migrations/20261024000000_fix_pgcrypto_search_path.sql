-- pgcrypto (gen_salt, crypt) is installed in the "extensions" schema.
-- These functions only searched "public", so creating admin users failed with
-- "function gen_salt(unknown, integer) does not exist". Applied to project dzavnjqstbbkcdfukgfp.
ALTER FUNCTION public.convert_admin_to_super_admin(text, text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_admin_user(text, text, text, text, uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_auth_user_with_custom_entry(text, text, text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_super_admin_directly(text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_super_admin_user(text, text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_admin_password(text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.verify_service_area_manager_password(text, text) SET search_path = public, extensions, pg_temp;
