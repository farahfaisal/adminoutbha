/*
  # Fix referral codes foreign key constraint

  1. Changes
    - Drop existing foreign key constraint that references auth.users
    - Add new foreign key constraint that references custom_users table
    - This aligns the referral_codes table with the application's user management system

  2. Security
    - Maintains referential integrity with the correct user table
    - Preserves existing data while fixing the constraint
*/

-- Drop the existing foreign key constraint that references auth.users
ALTER TABLE public.referral_codes DROP CONSTRAINT IF EXISTS referral_codes_user_id_fkey;

-- Add new foreign key constraint referencing custom_users table
ALTER TABLE public.referral_codes 
ADD CONSTRAINT referral_codes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.custom_users(id) ON DELETE CASCADE;