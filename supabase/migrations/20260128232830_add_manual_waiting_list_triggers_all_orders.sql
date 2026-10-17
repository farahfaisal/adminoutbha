/*
  # إضافة triggers للإضافة اليدوية إلى قائمة الانتظار

  1. التغييرات
    - إنشاء دالة عامة للإضافة إلى driver_waiting_list
    - إضافة triggers على captain_orders و parcel_orders
    - تحديث trigger على orders
    
  2. الوظيفة
    - عند تغيير حالة أي طلب إلى "waiting-for-driver" يدوياً
    - يتم إضافة الطلب تلقائياً إلى driver_waiting_list
*/

-- دالة للإضافة إلى driver_waiting_list لطلبات الكابتن
CREATE OR REPLACE FUNCTION add_captain_order_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تغيرت الحالة إلى 'waiting-for-driver'
  IF NEW.status = 'waiting-for-driver' AND (TG_OP = 'INSERT' OR OLD.status != 'waiting-for-driver') THEN
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      captain_order_id,
      vendor_id,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude
    ) VALUES (
      NEW.id,
      NULL, -- طلبات الكابتن ليس لها vendor
      'pending',
      now(),
      NEW.pickup_latitude,
      NEW.pickup_longitude
    )
    ON CONFLICT (captain_order_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- دالة للإضافة إلى driver_waiting_list لطلبات الطرود
CREATE OR REPLACE FUNCTION add_parcel_order_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تغيرت الحالة إلى 'waiting-for-driver'
  IF NEW.status = 'waiting-for-driver' AND (TG_OP = 'INSERT' OR OLD.status != 'waiting-for-driver') THEN
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      parcel_order_id,
      vendor_id,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude
    ) VALUES (
      NEW.id,
      NULL, -- طلبات الطرود ليس لها vendor
      'pending',
      now(),
      NEW.pickup_latitude,
      NEW.pickup_longitude
    )
    ON CONFLICT (parcel_order_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة trigger لطلبات الكابتن
DROP TRIGGER IF EXISTS trigger_add_captain_order_to_waiting_list ON captain_orders;

CREATE TRIGGER trigger_add_captain_order_to_waiting_list
  AFTER INSERT OR UPDATE ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_captain_order_to_waiting_list();

-- إضافة trigger لطلبات الطرود
DROP TRIGGER IF EXISTS trigger_add_parcel_order_to_waiting_list ON parcel_orders;

CREATE TRIGGER trigger_add_parcel_order_to_waiting_list
  AFTER INSERT OR UPDATE ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_parcel_order_to_waiting_list();