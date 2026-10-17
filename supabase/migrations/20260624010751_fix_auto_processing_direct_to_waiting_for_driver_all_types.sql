/*
  # تعديل المعالجة التلقائية لتنقل جميع أنواع الطلبات مباشرة إلى waiting-for-driver

  عند تفعيل المعالجة التلقائية:
  - الطلبات العادية (orders)
  - طلبات الطرود (parcel_orders)
  - طلبات الكابتن (captain_orders)
  
  جميعها تنتقل مباشرة من pending → waiting-for-driver وتُضاف لقائمة الانتظار فوراً
*/

-- ========================================
-- 1. إعادة كتابة دالة auto_process_new_order
-- لتنقل مباشرة إلى waiting-for-driver
-- ========================================
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
BEGIN
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  IF v_auto_processing AND NEW.status = 'pending' THEN
    NEW.status := 'waiting-for-driver';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- 2. إعادة كتابة دالة auto_add_to_waiting_list
-- لتعمل على waiting-for-driver بدلاً من processing
-- ========================================
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
BEGIN
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  IF v_auto_processing AND NEW.status = 'waiting-for-driver' THEN
    IF TG_TABLE_NAME = 'orders' THEN
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
      )
      ON CONFLICT DO NOTHING;
      
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
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
      )
      ON CONFLICT DO NOTHING;
      
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
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
        NEW.delivery_fee,
        'pending',
        now(),
        NEW.sender_latitude,
        NEW.sender_longitude
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

-- ========================================
-- 3. التأكد من وجود الـ triggers على الجداول الثلاثة
-- ========================================

-- orders
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- captain_orders
DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_captain_to_waiting_list_trigger ON captain_orders;
CREATE TRIGGER auto_add_captain_to_waiting_list_trigger
  AFTER INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- parcel_orders
DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;
CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();
