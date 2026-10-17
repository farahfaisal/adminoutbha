/*
  # تفعيل الإشعارات الصوتية للمديرين
  
  1. التغييرات
    - إضافة unique constraint على user_id
    - إنشاء إعدادات افتراضية للمديرين الموجودين في auth.users (الصوت مفعل)
  
  2. الهدف
    - ضمان حصول جميع المديرين على إشعارات صوتية عند وصول طلبات جديدة
    - حتى عندما تكون المعالجة التلقائية معطلة
*/

-- حذف السجلات المكررة (الاحتفاظ بالأحدث)
DELETE FROM notification_settings a
USING notification_settings b
WHERE a.id < b.id 
  AND a.user_id = b.user_id;

-- إضافة unique constraint على user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notification_settings_user_id_key'
  ) THEN
    ALTER TABLE notification_settings 
    ADD CONSTRAINT notification_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- إنشاء إعدادات افتراضية لجميع المديرين الموجودين في auth.users
INSERT INTO notification_settings (
  id,
  user_id,
  sound_enabled,
  continuous_sound_enabled,
  browser_notifications_enabled,
  auto_notifications_enabled,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  au.id,
  true,
  true,
  true,
  true,
  now(),
  now()
FROM auth.users au
WHERE EXISTS (
  SELECT 1 FROM admin_users WHERE user_id = au.id
)
AND NOT EXISTS (
  SELECT 1 FROM notification_settings WHERE user_id = au.id
)
ON CONFLICT (user_id) DO UPDATE SET
  sound_enabled = true,
  continuous_sound_enabled = true,
  browser_notifications_enabled = true,
  auto_notifications_enabled = true,
  updated_at = now();

-- إنشاء إعدادات افتراضية لجميع Super Admins الموجودين في auth.users
INSERT INTO notification_settings (
  id,
  user_id,
  sound_enabled,
  continuous_sound_enabled,
  browser_notifications_enabled,
  auto_notifications_enabled,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  au.id,
  true,
  true,
  true,
  true,
  now(),
  now()
FROM auth.users au
WHERE EXISTS (
  SELECT 1 FROM super_admins WHERE user_id = au.id
)
AND NOT EXISTS (
  SELECT 1 FROM notification_settings WHERE user_id = au.id
)
ON CONFLICT (user_id) DO UPDATE SET
  sound_enabled = true,
  continuous_sound_enabled = true,
  browser_notifications_enabled = true,
  auto_notifications_enabled = true,
  updated_at = now();