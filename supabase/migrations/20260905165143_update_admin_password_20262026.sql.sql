/*
# Update admin password to 20262026

1. Changes
- Update the password_hash for the admin user in admin_users table
- Uses crypt() with gen_salt('bf') for secure bcrypt hashing
- The admin can now log in with username "admin" and password "20262026"
*/

UPDATE public.admin_users
SET password_hash = crypt('20262026', gen_salt('bf')),
    updated_at = now()
WHERE username = 'admin';
