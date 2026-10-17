/*
  # إصلاح الطلبات في processing بدون سائق

  1. المشكلة
    - يوجد 11 طلب في حالة "processing" لكن بدون driver_id
    - الطلب لا يجب أن يكون في "processing" إلا إذا كان له سائق
    - هذا يسبب مشاكل في تتبع الطلبات

  2. الحل
    - تغيير حالة جميع الطلبات من "processing" إلى "waiting-for-driver" إذا لم يكن لهم driver_id
    - إضافة هذه الطلبات إلى driver_waiting_list
    - إضافة trigger يمنع أن يكون الطلب في "processing" بدون driver_id

  3. المنطق الصحيح
    - pending: طلب جديد
    - waiting-for-driver: في انتظار قبول سائق (يجب أن يكون في driver_waiting_list)
    - processing: تم قبوله من سائق (يجب أن يكون له driver_id)
    - delivered: تم التوصيل
*/

-- 1. تغيير حالة الطلبات من processing إلى waiting-for-driver إذا لم يكن لهم driver_id
UPDATE orders
SET 
  status = 'waiting-for-driver',
  updated_at = now()
WHERE status = 'processing' 
  AND driver_id IS NULL;

-- 2. إضافة هذه الطلبات إلى driver_waiting_list
INSERT INTO driver_waiting_list (
  order_id,
  vendor_id,
  status,
  created_at,
  geocoded_latitude,
  geocoded_longitude
)
SELECT
  o.id,
  o.vendor_id,
  'pending',
  now(),
  o.latitude,
  o.longitude
FROM orders o
WHERE o.status = 'waiting-for-driver'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- 3. إنشاء trigger لمنع أن يكون الطلب في processing بدون driver_id
CREATE OR REPLACE FUNCTION validate_processing_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- إذا كانت الحالة الجديدة "processing" ولا يوجد driver_id، أرجع خطأ
  IF NEW.status = 'processing' AND NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب إلى "processing" بدون تعيين سائق';
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger
DROP TRIGGER IF EXISTS validate_processing_status_trigger ON orders;

CREATE TRIGGER validate_processing_status_trigger
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_processing_status();