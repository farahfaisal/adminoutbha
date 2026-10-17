/*
  # إصلاح عدم ظهور تنبيه الطلبات المعلقة للمديرين

  ## المشكلة
  التنبيه الذي يظهر أعلى لوحة التحكم للطلبات المعلقة لا يظهر للمديرين
  السبب: لا توجد سياسة RLS تسمح للمديرين بقراءة الطلبات بحالة 'pending'

  ## الحل
  إضافة سياسات SELECT للمديرين على جداول:
  - orders (الطلبات العادية)
  - captain_orders (طلبات الكابتن)
  - parcel_orders (طلبات الطرود)

  ## من هم المديرون؟
  - المستخدمون في جدول admin_users
  - المستخدمون في جدول super_admins
  - مديرو المناطق في جدول service_area_managers

  ## التطبيق
  نفذ هذا الـ SQL في Supabase Dashboard → SQL Editor
*/

-- ========================================
-- جدول orders (الطلبات العادية)
-- ========================================

-- حذف السياسة القديمة إن وجدت
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- إنشاء سياسة جديدة للمديرين
CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
TO authenticated
USING (
  -- المستخدمون في جدول admin_users
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
  OR
  -- المستخدمون في جدول super_admins
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  )
  OR
  -- مديرو المناطق في جدول service_area_managers
  EXISTS (
    SELECT 1 FROM service_area_managers
    WHERE service_area_managers.user_id = auth.uid()
  )
);

-- ========================================
-- جدول captain_orders (طلبات الكابتن)
-- ========================================

-- حذف السياسة القديمة إن وجدت وإعادة إنشائها
DROP POLICY IF EXISTS "Admins can view all captain orders" ON captain_orders;

CREATE POLICY "Admins can view all captain orders"
ON captain_orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM service_area_managers
    WHERE service_area_managers.user_id = auth.uid()
  )
);

-- ========================================
-- جدول parcel_orders (طلبات الطرود)
-- ========================================

-- حذف السياسة القديمة إن وجدت وإعادة إنشائها
DROP POLICY IF EXISTS "Admins can view all parcel orders" ON parcel_orders;

CREATE POLICY "Admins can view all parcel orders"
ON parcel_orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM service_area_managers
    WHERE service_area_managers.user_id = auth.uid()
  )
);

-- ========================================
-- التحقق من النتيجة
-- ========================================

-- عرض السياسات المُنشأة
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('orders', 'captain_orders', 'parcel_orders')
AND policyname LIKE '%Admin%'
ORDER BY tablename;
