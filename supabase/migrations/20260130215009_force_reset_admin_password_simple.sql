/*
  # Force Reset admin@system.local Password - Simple Method
  
  1. Changes
    - Reset password to: admin123456
    - Use simple bcrypt hashing
  
  2. Security
    - User should change after first login
*/

-- Force update password with proper bcrypt hash
UPDATE auth.users
SET 
    encrypted_password = crypt('admin123456', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@system.local';

-- Also ensure super_admin record is active
UPDATE super_admins
SET 
    status = 'active',
    updated_at = now()
WHERE email = 'admin@system.local';
