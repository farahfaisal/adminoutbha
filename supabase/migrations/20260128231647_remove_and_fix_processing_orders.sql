/*
  # حذف trigger مؤقتاً، إصلاح الطلبات، ثم إعادته

  1. الخطوات
    - حذف trigger التحقق مؤقتاً
    - إصلاح الطلبات في processing بدون سائق
    - إعادة إنشاء trigger محسّن
*/

-- 1. حذف trigger مؤقتاً
DROP TRIGGER IF EXISTS validate_processing_status_trigger ON orders;
DROP FUNCTION IF EXISTS validate_processing_status();

-- 2. إصلاح الطلبات
UPDATE orders
SET 
  status = 'waiting-for-driver',
  updated_at = now()
WHERE status = 'processing' 
  AND driver_id IS NULL;

-- 3. إضافة الطلبات إلى driver_waiting_list
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

-- 4. إعادة إنشاء trigger محسّن (يعمل فقط على INSERT)
CREATE OR REPLACE FUNCTION validate_processing_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- فقط على INSERT - منع إنشاء طلب جديد في processing بدون driver_id
  IF TG_OP = 'INSERT' AND NEW.status = 'processing' AND NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إنشاء طلب في حالة "processing" بدون تعيين سائق';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_processing_status_trigger
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_processing_status_on_insert();