/*
  # تقييد رؤية الطلبات بحالة pending للبائعين والسائقين
  
  ## الهدف
  تطبيق نظام المعالجة التلقائية/اليدوية:
  - المعالجة التلقائية: الطلب يصبح 'processing' → البائع والسائق يرونه فوراً ✅
  - المعالجة اليدوية: الطلب يبقى 'pending' → فقط المدير يراه ❌
  
  ## التغييرات
  
  ### 1. جدول orders (الطلبات العادية)
  - تعديل policies البائعين والسائقين: إضافة شرط `status != 'pending'`
  - المديرين: رؤية جميع الحالات (بدون تغيير)
  
  ### 2. جدول captain_orders (طلبات الكابتن)
  - تعديل policies البائعين والسائقين: إضافة شرط `status != 'pending'`
  - المديرين: رؤية جميع الحالات (بدون تغيير)
  
  ### 3. جدول parcel_orders (طلبات الطرود)
  - تعديل policies السائقين: إضافة شرط `status != 'pending'`
  - المديرين: رؤية جميع الحالات (بدون تغيير)
  
  ## ملاحظات مهمة
  - المديرين (admin_users) يرون جميع الطلبات بغض النظر عن الحالة
  - مديرو المناطق (service_area_managers) يرون جميع الطلبات في مناطقهم
  - العملاء يرون طلباتهم الخاصة في جميع الحالات
*/

-- ========================================
-- جدول orders (الطلبات العادية)
-- ========================================

-- حذف policies البائعين والسائقين القديمة
DROP POLICY IF EXISTS "Vendors can view their orders" ON orders;
DROP POLICY IF EXISTS "Drivers can view their orders" ON orders;

-- إنشاء policies جديدة مع شرط استبعاد حالة pending
CREATE POLICY "Vendors can view their orders (exclude pending)"
ON orders FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT vendors.id
    FROM vendors
    WHERE vendors.user_id = auth.uid()
  )
  AND status != 'pending'
);

CREATE POLICY "Drivers can view their assigned orders (exclude pending)"
ON orders FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND status != 'pending'
);

-- ========================================
-- جدول captain_orders (طلبات الكابتن)
-- ========================================

-- حذف policies البائعين والسائقين القديمة
DROP POLICY IF EXISTS "Vendors can view own captain orders" ON captain_orders;
DROP POLICY IF EXISTS "Drivers can view assigned captain orders" ON captain_orders;

-- إنشاء policies جديدة مع شرط استبعاد حالة pending
CREATE POLICY "Vendors can view own captain orders (exclude pending)"
ON captain_orders FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT vendors.id
    FROM vendors
    WHERE vendors.user_id = auth.uid()
  )
  AND status != 'pending'
);

CREATE POLICY "Drivers can view assigned captain orders (exclude pending)"
ON captain_orders FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND status != 'pending'
);

-- ========================================
-- جدول parcel_orders (طلبات الطرود)
-- ========================================

-- حذف policy السائقين القديمة
DROP POLICY IF EXISTS "Drivers can view their assigned parcel orders" ON parcel_orders;

-- إنشاء policy جديدة مع شرط استبعاد حالة pending
CREATE POLICY "Drivers can view their assigned parcel orders (exclude pending)"
ON parcel_orders FOR SELECT
TO authenticated
USING (
  driver_id IN (
    SELECT drivers.id
    FROM drivers
    WHERE drivers.user_id = auth.uid()
  )
  AND status != 'pending'
);

-- ========================================
-- حذف policies "الجميع يرى كل شيء" للأمان
-- ========================================

-- حذف policies غير آمنة في جدول orders
DROP POLICY IF EXISTS "Public can view orders" ON orders;
DROP POLICY IF EXISTS "Anonymous users can view orders" ON orders;
DROP POLICY IF EXISTS "Allow viewing all orders" ON orders;

-- حذف policy غير آمنة في جدول parcel_orders
DROP POLICY IF EXISTS "Users can view all parcel orders" ON parcel_orders;

-- ========================================
-- ملاحظة: المديرين ومديرو المناطق والعملاء
-- ========================================
-- لم يتم تعديل policies:
-- - Admins can view all orders (يرون كل شيء)
-- - Service area managers can view orders (يرون طلبات مناطقهم)
-- - Customers can view their own orders (يرون طلباتهم الخاصة في جميع الحالات)
