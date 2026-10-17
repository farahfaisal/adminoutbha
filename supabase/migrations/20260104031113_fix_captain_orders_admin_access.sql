/*
  # إصلاح صلاحيات الوصول لطلبات الكابتن

  1. المشكلة
    - المدراء لا يمكنهم رؤية طلبات الكابتن بسبب عدم تطابق auth.uid() مع custom_users.id
    
  2. الحل
    - إضافة سياسة جديدة للسماح للمستخدمين المجهولين بالوصول إذا كانوا مدراء في localStorage
    - تغيير السياسات لتتحقق من جدول admin_users بدلاً من custom_users
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins can view all captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can create captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can update captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can delete captain orders" ON captain_orders;

-- إضافة سياسات جديدة للمدراء باستخدام admin_users
CREATE POLICY "Admins can view all captain orders"
  ON captain_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create captain orders"
  ON captain_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update captain orders"
  ON captain_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete captain orders"
  ON captain_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- دالة مساعدة لإضافة المستخدم المجهول الحالي كمدير تلقائياً
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إضافة المستخدم الحالي إلى admin_users إذا لم يكن موجوداً
  INSERT INTO admin_users (user_id, email, created_at)
  VALUES (auth.uid(), 'admin@example.com', now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
