/*
  # Enable RLS on super_admins table
  
  1. Changes
    - Enable Row Level Security on super_admins table
    - This will activate all existing policies
  
  2. Security
    - RLS must be enabled for policies to work
    - Users can view their own super admin record
    - Super admins can view all records
*/

-- Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
