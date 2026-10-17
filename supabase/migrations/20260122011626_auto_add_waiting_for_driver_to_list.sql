/*
  # إضافة تلقائية للطلبات إلى قائمة انتظار السائقين

  1. التغييرات
    - إنشاء دالة trigger تضيف تلقائياً أي طلب بحالة "waiting-for-driver" إلى driver_waiting_list
    - عند إضافة طلب جديد بحالة "waiting-for-driver"
    - عند تحديث طلب من أي حالة إلى "waiting-for-driver"
    
  2. الوظيفة
    - تتحقق من الحالة الجديدة
    - تضيف الطلب إلى driver_waiting_list تلقائياً
    - تتجنب التكرار باستخدام ON CONFLICT
*/

-- دالة لإضافة الطلب تلقائياً إلى قائمة انتظار السائقين
CREATE OR REPLACE FUNCTION auto_add_to_driver_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عند إضافة طلب جديد أو تحديث حالة طلب إلى waiting-for-driver
  IF NEW.status = 'waiting-for-driver' AND (TG_OP = 'INSERT' OR OLD.status != 'waiting-for-driver') THEN
    -- إضافة الطلب إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude,
      preparation_time,
      preparation_start,
      preparation_end
    ) VALUES (
      NEW.id,
      NEW.vendor_id,
      'pending',
      now(),
      NEW.geocoded_latitude,
      NEW.geocoded_longitude,
      NEW.preparation_time,
      NEW.preparation_start,
      NEW.preparation_end
    )
    ON CONFLICT (order_id) DO UPDATE SET
      status = 'pending',
      updated_at = now(),
      geocoded_latitude = EXCLUDED.geocoded_latitude,
      geocoded_longitude = EXCLUDED.geocoded_longitude,
      preparation_time = EXCLUDED.preparation_time,
      preparation_start = EXCLUDED.preparation_start,
      preparation_end = EXCLUDED.preparation_end;
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS auto_add_to_driver_waiting_list_trigger ON orders;

-- إنشاء الـ trigger الجديد
CREATE TRIGGER auto_add_to_driver_waiting_list_trigger
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_driver_waiting_list();