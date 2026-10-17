/*
  # إصلاح العلاقة بين captain_orders و drivers

  1. التغييرات
    - حذف القيد الحالي الذي يشير إلى auth.users
    - إضافة قيد جديد يشير إلى جدول drivers

  2. الملاحظات
    - هذا يسمح لـ Supabase بعمل JOIN بين captain_orders و drivers
*/

-- حذف القيد الحالي
ALTER TABLE captain_orders
DROP CONSTRAINT IF EXISTS captain_orders_driver_id_fkey;

-- إضافة القيد الجديد الذي يشير إلى جدول drivers
ALTER TABLE captain_orders
ADD CONSTRAINT captain_orders_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES drivers(id)
ON DELETE SET NULL;
