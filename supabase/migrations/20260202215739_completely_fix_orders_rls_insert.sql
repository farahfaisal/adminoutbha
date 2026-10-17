/*
  # إصلاح كامل لسياسات INSERT في جدول orders

  1. المشكلة
    - السياسة "Allow all users to create orders" لا تعمل
    - الإدراج يفشل مع RLS مفعل حتى مع السياسة

  2. الحل
    - حذف السياسة القديمة
    - إنشاء سياسات منفصلة لكل role
    - استخدام صيغة صحيحة للسياسات
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Allow all users to create orders" ON orders;

-- إنشاء سياسات منفصلة لكل role
CREATE POLICY "anon_insert_orders"
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_insert_orders"
  ON orders
  FOR INSERT  
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "service_role_insert_orders"
  ON orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);
