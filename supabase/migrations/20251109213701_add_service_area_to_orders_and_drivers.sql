/*
  # إضافة منطقة الخدمة للطلبات والسائقين

  1. التعديلات
    - إضافة عمود `service_area_id` لجدول `orders`
    - إضافة عمود `service_area_id` لجدول `drivers`
    - إضافة سياسات RLS للتصفية حسب المنطقة

  2. الأمان
    - تحديث سياسات RLS لدعم مسؤولي المناطق
    - مسؤول المنطقة يرى فقط الطلبات والسائقين في منطقته

  3. ملاحظات
    - يتم ربط الطلب بمنطقة الخدمة من خلال عنوان التوصيل
    - يتم ربط السائق بمنطقة خدمة واحدة أو أكثر
*/

-- إضافة عمود service_area_id لجدول الطلبات
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN service_area_id uuid REFERENCES service_areas(id);
  END IF;
END $$;

-- إضافة عمود service_area_id لجدول السائقين
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN service_area_id uuid REFERENCES service_areas(id);
  END IF;
END $$;

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_orders_service_area_id ON orders(service_area_id);
CREATE INDEX IF NOT EXISTS idx_drivers_service_area_id ON drivers(service_area_id);

-- سياسات RLS للطلبات - مسؤولو المناطق يرون طلبات مناطقهم فقط
DROP POLICY IF EXISTS "Service area managers can read their area orders" ON orders;
CREATE POLICY "Service area managers can read their area orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_area_managers sam
      JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
      WHERE sam.user_id = auth.uid()
      AND sama.service_area_id = orders.service_area_id
    )
  );

-- سياسات RLS للطلبات - مسؤولو المناطق يمكنهم تحديث طلبات مناطقهم
DROP POLICY IF EXISTS "Service area managers can update their area orders" ON orders;
CREATE POLICY "Service area managers can update their area orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_area_managers sam
      JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
      WHERE sam.user_id = auth.uid()
      AND sama.service_area_id = orders.service_area_id
    )
  );

-- سياسات RLS للسائقين - مسؤولو المناطق يرون سائقي مناطقهم فقط
DROP POLICY IF EXISTS "Service area managers can read their area drivers" ON drivers;
CREATE POLICY "Service area managers can read their area drivers"
  ON drivers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_area_managers sam
      JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
      WHERE sam.user_id = auth.uid()
      AND sama.service_area_id = drivers.service_area_id
    )
  );

-- سياسات RLS للسائقين - مسؤولو المناطق يمكنهم تحديث سائقي مناطقهم
DROP POLICY IF EXISTS "Service area managers can update their area drivers" ON drivers;
CREATE POLICY "Service area managers can update their area drivers"
  ON drivers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_area_managers sam
      JOIN service_area_manager_assignments sama ON sam.id = sama.manager_id
      WHERE sam.user_id = auth.uid()
      AND sama.service_area_id = drivers.service_area_id
    )
  );
