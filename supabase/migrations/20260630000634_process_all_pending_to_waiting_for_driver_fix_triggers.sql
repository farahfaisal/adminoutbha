
-- معالجة جميع الطلبات المعلقة وإضافتها لقائمة انتظار السائقين

-- ===================================================
-- 1. الطلبات العادية: pending -> waiting-for-driver
-- ===================================================
UPDATE orders
SET status = 'waiting-for-driver'
WHERE status = 'pending';

INSERT INTO driver_waiting_list (order_id, vendor_id, total, status, created_at)
SELECT
  o.id,
  o.vendor_id,
  o.total,
  'pending',
  now()
FROM orders o
WHERE o.status = 'waiting-for-driver'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  );

-- ===================================================
-- 2. طلبات الطرود: pending -> waiting-for-driver
-- ===================================================
UPDATE parcel_orders
SET status = 'waiting-for-driver'
WHERE status = 'pending';

INSERT INTO driver_waiting_list (parcel_order_id, vendor_id, total, status, created_at, geocoded_latitude, geocoded_longitude)
SELECT
  po.id,
  NULL,
  po.delivery_fee,
  'pending',
  now(),
  po.sender_latitude,
  po.sender_longitude
FROM parcel_orders po
WHERE po.status = 'waiting-for-driver'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = po.id
  );

-- ===================================================
-- 3. طلبات الكابتن: pending -> waiting-for-driver
-- ===================================================
UPDATE captain_orders
SET status = 'waiting-for-driver'
WHERE status = 'pending';

INSERT INTO driver_waiting_list (captain_order_id, vendor_id, total, status, created_at)
SELECT
  co.id,
  NULL,
  co.delivery_fee,
  'pending',
  now()
FROM captain_orders co
WHERE co.status = 'waiting-for-driver'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.captain_order_id = co.id
  );

-- ===================================================
-- 4. إصلاح دالة auto_process_new_order لتعمل مع captain_orders
-- ===================================================
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

-- ===================================================
-- 5. إصلاح دالة auto_add_to_waiting_list لتعمل مع captain_orders (بدون total)
-- ===================================================
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
        order_id, vendor_id, total, status, created_at
      ) VALUES (
        NEW.id, NEW.vendor_id, NEW.total, 'pending', now()
      )
      ON CONFLICT DO NOTHING;

    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      INSERT INTO driver_waiting_list (
        captain_order_id, vendor_id, total, status, created_at
      ) VALUES (
        NEW.id, NULL, NEW.delivery_fee, 'pending', now()
      )
      ON CONFLICT DO NOTHING;

    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      INSERT INTO driver_waiting_list (
        parcel_order_id, vendor_id, total, status, created_at,
        geocoded_latitude, geocoded_longitude
      ) VALUES (
        NEW.id, NULL, NEW.delivery_fee, 'pending', now(),
        NEW.sender_latitude, NEW.sender_longitude
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

-- ===================================================
-- 6. التأكد من وجود جميع الـ triggers
-- ===================================================
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_captain_to_waiting_list_trigger ON captain_orders;
CREATE TRIGGER auto_add_captain_to_waiting_list_trigger
  AFTER INSERT ON captain_orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;
CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

-- ===================================================
-- 7. تحديث الإعدادات: autoProcessingStatus = waiting-for-driver
-- ===================================================
UPDATE app_settings
SET settings = jsonb_set(
  jsonb_set(settings, '{orders,autoProcessing}', 'true'),
  '{orders,autoProcessingStatus}',
  '"waiting-for-driver"'
);
