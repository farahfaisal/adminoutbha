/*
  # Reset admin@system.local password
  
  1. Changes
    - Reset password for admin@system.local to a known password
    - Password will be: SuperAdmin@2026
  
  2. Security
    - User should change this password after first login
*/

-- Update password for admin@system.local
UPDATE auth.users
SET 
    encrypted_password = crypt('SuperAdmin@2026', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@system.local';
