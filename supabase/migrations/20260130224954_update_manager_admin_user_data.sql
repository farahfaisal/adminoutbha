/*
  # تحديث بيانات manager@system.local في admin_users
  
  ## الوصف
  تحديث بيانات المستخدم manager@system.local في جدول admin_users
  المستخدم موجود لكن البيانات ناقصة
  
  ## التغييرات
  - إضافة username: manager
  - إضافة email: manager@system.local
  - إضافة full_name: مدير النظام
  - تحديث password_hash
  - التأكد من is_active = true
*/

-- تحديث بيانات المستخدم في admin_users
UPDATE admin_users
SET 
  username = 'manager',
  email = 'manager@system.local',
  full_name = 'مدير النظام',
  password_hash = crypt('MySecure@Pass2024!', gen_salt('bf', 10)),
  is_active = true
WHERE user_id = '3fd42b1c-49ce-4855-bf01-f73dc6102248';

-- عرض ملخص الصلاحيات الكاملة
SELECT 
  '===== صلاحيات المستخدم manager@system.local =====' as info
UNION ALL
SELECT 
  'البريد الإلكتروني: ' || sa.email
FROM super_admins sa
WHERE sa.email = 'manager@system.local'
UNION ALL
SELECT 
  'الحالة في super_admins: ' || sa.status
FROM super_admins sa
WHERE sa.email = 'manager@system.local'
UNION ALL
SELECT 
  'الصلاحيات: ' || 
  CASE 
    WHEN (sa.permissions->>'all')::boolean THEN 'صلاحيات كاملة ✓'
    ELSE 'صلاحيات محدودة'
  END
FROM super_admins sa
WHERE sa.email = 'manager@system.local'
UNION ALL
SELECT 
  'اسم المستخدم في admin_users: ' || COALESCE(au.username, 'غير محدد')
FROM admin_users au
WHERE au.user_id = '3fd42b1c-49ce-4855-bf01-f73dc6102248'
UNION ALL
SELECT 
  'الحالة في admin_users: ' || 
  CASE WHEN au.is_active THEN 'نشط ✓' ELSE 'غير نشط' END
FROM admin_users au
WHERE au.user_id = '3fd42b1c-49ce-4855-bf01-f73dc6102248'
UNION ALL
SELECT '=================================================' as info;
