/*
  # إصلاح RLS وسياسات جدول المنتجات
  
  1. التغييرات
    - تفعيل RLS على جدول products
    - حذف السياسات المتضاربة
    - إضافة سياسات واضحة ومنظمة:
      * سماح للجميع بعرض المنتجات النشطة
      * سماح للأدمن بعرض جميع المنتجات
      * سماح للبائعين بإدارة منتجاتهم فقط
      * سماح للأدمن بإدارة جميع المنتجات
  
  2. الأمان
    - RLS مفعّل لحماية البيانات
    - سياسات محددة لكل دور
    - التحقق من الصلاحيات في كل عملية
*/

-- تفعيل RLS على جدول products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- حذف جميع السياسات القديمة
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Public can view active products" ON products;
DROP POLICY IF EXISTS "Vendors can manage their own products" ON products;
DROP POLICY IF EXISTS "Vendors can manage their products" ON products;
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Vendors can view their products" ON products;
DROP POLICY IF EXISTS "Vendors can insert their products" ON products;
DROP POLICY IF EXISTS "Vendors can update their products" ON products;
DROP POLICY IF EXISTS "Vendors can delete their products" ON products;
DROP POLICY IF EXISTS "Admins can manage all products" ON products;

-- سياسة 1: الجميع يمكنهم عرض المنتجات النشطة
CREATE POLICY "Public can view active products"
  ON products
  FOR SELECT
  TO public
  USING (status = 'active');

-- سياسة 2: الأدمن يمكنهم عرض جميع المنتجات
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  );

-- سياسة 3: البائعين يمكنهم عرض منتجاتهم
CREATE POLICY "Vendors can view their products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- سياسة 4: البائعين يمكنهم إضافة منتجات لمتاجرهم
CREATE POLICY "Vendors can insert their products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- سياسة 5: البائعين يمكنهم تحديث منتجاتهم
CREATE POLICY "Vendors can update their products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- سياسة 6: البائعين يمكنهم حذف منتجاتهم
CREATE POLICY "Vendors can delete their products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- سياسة 7: الأدمن يمكنهم إدارة جميع المنتجات
CREATE POLICY "Admins can manage all products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  );
