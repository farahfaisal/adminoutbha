/*
  # Disable automatic admin_users trigger
  
  1. Changes
    - Drop the trigger that automatically adds users to admin_users
    - This trigger is no longer needed with the new Super Admin system
    - Super Admins are managed through super_admins table
    - Regular admins should be created explicitly, not automatically
  
  2. Security
    - Prevents automatic elevation of all users to admin status
    - Super Admin system is now the primary authentication method
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function as well since it's no longer needed
DROP FUNCTION IF EXISTS add_user_to_admin();
