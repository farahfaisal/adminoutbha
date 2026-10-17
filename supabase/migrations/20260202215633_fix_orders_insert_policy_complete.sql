/*
  # إصلاح سياسات INSERT للطلبات بشكل كامل

  1. المشكلة
    - سياسات INSERT موجودة لكن لا تعمل
    - الإدراج يفشل حتى مع السياسات الموجودة
    - حاجة لإعادة بناء السياسات من الصفر

  2. الحل
    - حذف جميع سياسات INSERT القديمة
    - إنشاء سياسة واحدة شاملة تسمح للجميع بإنشاء الطلبات
*/

-- حذف جميع سياسات INSERT القديمة
DROP POLICY IF EXISTS "Anonymous users can create orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Orders can be created by anyone" ON orders;
DROP POLICY IF EXISTS "Public can create orders" ON orders;

-- إنشاء سياسة واحدة شاملة للجميع
CREATE POLICY "Allow all users to create orders"
  ON orders
  FOR INSERT
  WITH CHECK (true);
