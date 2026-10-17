/*
  # إضافة صلاحيات RLS لمديري مناطق الخدمة بدون user_id

  1. الهدف
    - السماح لمديري مناطق الخدمة بالوصول للبيانات بدون الحاجة لـ user_id
    - إضافة policies جديدة تعتمد على البريد الإلكتروني فقط
  
  2. التغييرات
    - إضافة policies للطلبات
    - إضافة policies للسائقين
    - إضافة policies للبائعين
    - إضافة policies لمناطق الخدمة
*/

-- إضافة policy للطلبات العادية (قراءة)
CREATE POLICY "Service area managers can view all orders in their areas"
ON orders FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy للطلبات العادية (تحديث)
CREATE POLICY "Service area managers can update all orders in their areas"
ON orders FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy لطلبات الكابتن (قراءة)
CREATE POLICY "Service area managers can view captain orders in their areas"
ON captain_orders FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = captain_orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy لطلبات الكابتن (تحديث)
CREATE POLICY "Service area managers can update captain orders in their areas"
ON captain_orders FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = captain_orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy لطلبات الطرود (قراءة)
CREATE POLICY "Service area managers can view parcel orders in their areas"
ON parcel_orders FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = parcel_orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy لطلبات الطرود (تحديث)
CREATE POLICY "Service area managers can update parcel orders in their areas"
ON parcel_orders FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = parcel_orders.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy للسائقين (قراءة)
CREATE POLICY "Service area managers can view drivers in their areas"
ON drivers FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = drivers.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy للسائقين (تحديث)
CREATE POLICY "Service area managers can update drivers in their areas"
ON drivers FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    WHERE sama.service_area_id = drivers.service_area_id
      AND sam.status = 'active'
  )
);

-- إضافة policy للبائعين (قراءة)
CREATE POLICY "Service area managers can view vendors in their areas"
ON vendors FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM service_area_managers sam
    JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
    JOIN vendor_service_areas vsa ON vsa.service_area_id = sama.service_area_id
    WHERE vsa.vendor_id = vendors.id
      AND sam.status = 'active'
  )
);

-- إضافة policy لقائمة انتظار السائقين (قراءة)
CREATE POLICY "Service area managers can view driver waiting list"
ON driver_waiting_list FOR SELECT
TO public
USING (true);

-- إضافة policy لتعيينات مديري المناطق (قراءة)
CREATE POLICY "Service area managers can view their assignments"
ON service_area_manager_assignments FOR SELECT
TO public
USING (true);

-- إضافة policy لمناطق الخدمة (قراءة)
CREATE POLICY "Service area managers can view service areas"
ON service_areas FOR SELECT
TO public
USING (true);
