/*
  # إضافة صلاحيات المدراء لجدول طلبات الكابتن

  1. السياسات الجديدة
    - السماح للمدراء بعرض جميع طلبات الكابتن
    - السماح للمدراء بإنشاء طلبات كابتن
    - السماح للمدراء بتحديث طلبات الكابتن
    - السماح للمدراء بحذف طلبات الكابتن

  2. الملاحظات
    - يتم التحقق من دور المدير من خلال جدول custom_users
    - المدراء لديهم صلاحيات كاملة على جدول captain_orders
*/

-- حذف السياسات إذا كانت موجودة
DROP POLICY IF EXISTS "Admins can view all captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can create captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can update captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Admins can delete captain orders" ON captain_orders;

-- سياسة عرض جميع طلبات الكابتن للمدراء
CREATE POLICY "Admins can view all captain orders"
  ON captain_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.id = auth.uid()
      AND custom_users.role = 'admin'
    )
  );

-- سياسة إنشاء طلبات كابتن للمدراء
CREATE POLICY "Admins can create captain orders"
  ON captain_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.id = auth.uid()
      AND custom_users.role = 'admin'
    )
  );

-- سياسة تحديث طلبات الكابتن للمدراء
CREATE POLICY "Admins can update captain orders"
  ON captain_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.id = auth.uid()
      AND custom_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.id = auth.uid()
      AND custom_users.role = 'admin'
    )
  );

-- سياسة حذف طلبات الكابتن للمدراء
CREATE POLICY "Admins can delete captain orders"
  ON captain_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_users
      WHERE custom_users.id = auth.uid()
      AND custom_users.role = 'admin'
    )
  );
