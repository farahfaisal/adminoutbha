/*
  # إزالة قيد المفتاح الأجنبي من جدول admin_users

  ## المشكلة
  - جدول admin_users يحتوي على foreign key constraint يشير إلى auth.users
  - هذا يمنع إنشاء مستخدمين إداريين مستقلين
  - نريد نظام إدارة مستخدمين مستقل عن Supabase Auth

  ## الحل
  - إزالة foreign key constraint
  - الإبقاء على user_id كحقل UUID عادي
  - هذا يسمح بإنشاء مستخدمين إداريين بدون الحاجة لـ auth.users
*/

-- إزالة foreign key constraint إذا كان موجوداً
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admin_users_user_id_fkey'
  ) THEN
    ALTER TABLE admin_users DROP CONSTRAINT admin_users_user_id_fkey;
    RAISE NOTICE 'تم إزالة foreign key constraint بنجاح';
  END IF;
END $$;

-- التأكد من وجود index على user_id
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);