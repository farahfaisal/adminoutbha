/*
  # إصلاح سياسة الإدراج لمسؤولي المناطق

  ## المشكلة
  - سياسة الإدراج الحالية تتطلب أن يكون المستخدم في جدول admin_users
  - هذا يمنع إنشاء مسؤولي مناطق جدد

  ## الحل
  - تحديث السياسة للسماح بالإدراج من قبل:
    1. المستخدمين الموجودين في admin_users (المسؤولين)
    2. المستخدمين المصادق عليهم (لإنشاء حسابهم الخاص)
    3. استخدام service role key مباشرة (بدون RLS)
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Allow insert for admins" ON service_area_managers;

-- إنشاء سياسة جديدة أكثر مرونة
CREATE POLICY "Allow insert for admins and authenticated users"
  ON service_area_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- السماح للمسؤولين
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
    OR
    -- السماح للمستخدمين المصادق عليهم بإنشاء حساباتهم الخاصة فقط
    auth.uid() = user_id
  );

-- إضافة تعليق
COMMENT ON POLICY "Allow insert for admins and authenticated users" ON service_area_managers IS 
'يسمح للمسؤولين بإضافة أي مسؤول منطقة، ويسمح للمستخدمين المصادق عليهم بإنشاء حساباتهم الخاصة فقط';
