/*
  # إصلاح الإضافة التلقائية لطلبات الطرود في قائمة الانتظار
  
  ## المشكلة
  - عند تفعيل المعالجة التلقائية، طلبات الطرود تتحول إلى 'processing'
  - لكن دالة add_parcel_order_to_waiting_list القديمة تبحث عن 'waiting-for-driver'
  - دالة auto_add_to_waiting_list موجودة لكنها لا تستخدم pickup_latitude و pickup_longitude الصحيحة
  
  ## الحل
  - تحديث دالة auto_add_to_waiting_list لتستخدم الحقول الصحيحة من parcel_orders
  - إزالة الـ trigger المتضارب
  - التأكد من أن الطلبات تضاف تلقائياً عند المعالجة
*/

-- تحديث دالة auto_add_to_waiting_list لتعمل بشكل صحيح مع parcel_orders
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_pickup_lat DECIMAL;
  v_pickup_lng DECIMAL;
BEGIN
  -- الحصول على الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب في حالة processing
  IF v_auto_processing AND NEW.status = 'processing' THEN
    -- إضافة إلى driver_waiting_list حسب نوع الطلب
    IF TG_TABLE_NAME = 'orders' THEN
      -- طلبات عادية
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        total,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        NEW.total,
        'pending',
        now()
      );
      
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      -- طلبات كابتن
      INSERT INTO driver_waiting_list (
        captain_order_id,
        vendor_id,
        total,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NULL,
        NEW.total,
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      );
      
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- طلبات طرود - استخدام sender_latitude و sender_longitude
      INSERT INTO driver_waiting_list (
        parcel_order_id,
        vendor_id,
        total,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NULL,
        NEW.delivery_fee,  -- استخدام delivery_fee بدلاً من total
        'pending',
        now(),
        NEW.sender_latitude,  -- استخدام sender_latitude بدلاً من pickup_latitude
        NEW.sender_longitude  -- استخدام sender_longitude بدلاً من pickup_longitude
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- تجاهل الأخطاء إذا كان الطلب موجوداً بالفعل
    RETURN NEW;
END;
$$;

-- إزالة الـ trigger المتضارب القديم
DROP TRIGGER IF EXISTS trigger_add_parcel_order_to_waiting_list ON parcel_orders;

-- إزالة الدالة القديمة
DROP FUNCTION IF EXISTS add_parcel_order_to_waiting_list();

-- التأكد من أن الـ trigger الصحيح موجود
DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;
CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- إضافة الطلبات الموجودة في حالة processing إلى قائمة الانتظار
INSERT INTO driver_waiting_list (
  parcel_order_id,
  vendor_id,
  total,
  status,
  created_at,
  geocoded_latitude,
  geocoded_longitude
)
SELECT
  po.id,
  NULL,
  po.delivery_fee,
  'pending',
  now(),
  po.sender_latitude,
  po.sender_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
AND NOT EXISTS (
  SELECT 1 FROM driver_waiting_list dwl 
  WHERE dwl.parcel_order_id = po.id
);
