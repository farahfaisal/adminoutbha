/*
  # إضافة دعم طلبات الكابتن والطرود لقائمة انتظار السائقين

  1. التغييرات
    - إضافة عمود captain_order_id لطلبات الكابتن
    - إضافة عمود parcel_order_id لطلبات الطرود
    - تعديل order_id و vendor_id ليكونا nullable
    - إضافة foreign keys للأنواع الجديدة من الطلبات
    - إضافة constraint للتأكد من وجود نوع واحد فقط من الطلبات
    - إضافة unique constraints لكل نوع طلب
    
  2. المنطق
    - يمكن أن يكون السجل في driver_waiting_list لأحد الأنواع التالية:
      * طلب عادي (order_id)
      * طلب كابتن (captain_order_id)
      * طلب طرد (parcel_order_id)
    - لا يمكن أن يكون لنفس السجل أكثر من نوع واحد
*/

-- إضافة الأعمدة الجديدة
ALTER TABLE driver_waiting_list
ADD COLUMN IF NOT EXISTS captain_order_id UUID REFERENCES captain_orders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS parcel_order_id UUID REFERENCES parcel_orders(id) ON DELETE CASCADE;

-- تعديل order_id و vendor_id ليكونا nullable
ALTER TABLE driver_waiting_list
ALTER COLUMN order_id DROP NOT NULL,
ALTER COLUMN vendor_id DROP NOT NULL;

-- حذف unique constraint القديم إذا كان موجوداً
ALTER TABLE driver_waiting_list
DROP CONSTRAINT IF EXISTS driver_waiting_list_order_id_key;

-- إضافة unique constraints لكل نوع طلب
CREATE UNIQUE INDEX IF NOT EXISTS driver_waiting_list_order_id_unique
  ON driver_waiting_list(order_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS driver_waiting_list_captain_order_id_unique
  ON driver_waiting_list(captain_order_id)
  WHERE captain_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS driver_waiting_list_parcel_order_id_unique
  ON driver_waiting_list(parcel_order_id)
  WHERE parcel_order_id IS NOT NULL;

-- إضافة constraint للتأكد من وجود نوع واحد فقط من الطلبات
ALTER TABLE driver_waiting_list
DROP CONSTRAINT IF EXISTS driver_waiting_list_single_order_type;

ALTER TABLE driver_waiting_list
ADD CONSTRAINT driver_waiting_list_single_order_type
CHECK (
  (order_id IS NOT NULL AND captain_order_id IS NULL AND parcel_order_id IS NULL) OR
  (order_id IS NULL AND captain_order_id IS NOT NULL AND parcel_order_id IS NULL) OR
  (order_id IS NULL AND captain_order_id IS NULL AND parcel_order_id IS NOT NULL)
);

-- تحديث RLS policies لتشمل الأنواع الجديدة
DROP POLICY IF EXISTS "Drivers can view orders in waiting list" ON driver_waiting_list;

CREATE POLICY "Drivers can view orders in waiting list"
  ON driver_waiting_list
  FOR SELECT
  TO authenticated
  USING (
    -- السائقون يمكنهم رؤية جميع الطلبات في قائمة الانتظار
    status = 'pending' OR 
    -- أو الطلبات المخصصة لهم
    driver_id = auth.uid()
  );