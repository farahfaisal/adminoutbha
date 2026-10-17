-- ============================================================
-- المعالجة التلقائية لجميع أنواع الطلبات
-- عند تفعيل autoProcessing:
--   - الطلبات العادية (orders)
--   - طلبات الطرود (parcel_orders)
--   - طلبات الكابتن (captain_orders)
--   جميعها تنتقل من pending → processing وتُضاف لقائمة انتظار السائقين
-- ============================================================

-- 1) دالة المعالجة التلقائية: تحول pending → processing
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
BEGIN
  SELECT settings INTO v_settings FROM app_settings LIMIT 1;
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);

  IF v_auto_processing AND NEW.status = 'pending' THEN
    NEW.status := 'processing';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) دالة إضافة الطلب لقائمة الانتظار بعد المعالجة
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
BEGIN
  SELECT settings INTO v_settings FROM app_settings LIMIT 1;
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);

  IF NOT v_auto_processing OR NEW.status <> 'processing' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors WHERE id = NEW.vendor_id;

    INSERT INTO driver_waiting_list (
      order_id, vendor_id, customer_name, customer_phone,
      address, city, total, notes, payment_method,
      preparation_time, actual_preparation_time,
      preparation_start, preparation_end,
      order_number, vendor_name, items_data,
      geocoded_latitude, geocoded_longitude,
      vendor_geocoded_latitude, vendor_geocoded_longitude,
      status, created_at, expires_at
    ) VALUES (
      NEW.id, NEW.vendor_id, NEW.customer_name, NEW.customer_phone,
      NEW.address, NEW.city, NEW.total, NEW.notes, COALESCE(NEW.payment_method, 'cash'),
      NEW.preparation_time, NEW.actual_preparation_time,
      NEW.preparation_start, NEW.preparation_end,
      NEW.order_number, v_vendor_name, NEW.items_data,
      NEW.geocoded_latitude, NEW.geocoded_longitude,
      v_vendor_lat, v_vendor_lng,
      'pending', now(), NOW() + INTERVAL '365 days'
    )
    ON CONFLICT (order_id) DO NOTHING;

  ELSIF TG_TABLE_NAME = 'captain_orders' THEN
    INSERT INTO driver_waiting_list (
      captain_order_id, vendor_id, customer_name, customer_phone,
      address, total, notes, order_number,
      status, created_at, expires_at
    ) VALUES (
      NEW.id, NULL, NEW.customer_name, NEW.customer_phone,
      NEW.pickup_address, COALESCE(NEW.delivery_fee, 0), NEW.notes, NEW.order_number,
      'pending', now(), NOW() + INTERVAL '365 days'
    )
    ON CONFLICT DO NOTHING;

  ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
    INSERT INTO driver_waiting_list (
      parcel_order_id, vendor_id, customer_name, customer_phone,
      address, city, total, notes, order_number,
      geocoded_latitude, geocoded_longitude,
      status, created_at, expires_at
    ) VALUES (
      NEW.id, NULL, NEW.sender_name, NEW.sender_phone,
      NEW.sender_address, NEW.receiver_address, COALESCE(NEW.delivery_fee, 0),
      COALESCE(NEW.description, NEW.notes), NEW.order_number,
      NEW.sender_latitude, NEW.sender_longitude,
      'pending', now(), NOW() + INTERVAL '365 days'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_add_to_waiting_list failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) التأكد من وجود الـ triggers على الجداول الثلاثة

-- orders
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

-- captain_orders
DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_captain_to_waiting_list_trigger ON captain_orders;
CREATE TRIGGER auto_add_captain_to_waiting_list_trigger
  AFTER INSERT ON captain_orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

-- parcel_orders
DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;
CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waiting_list();

-- 4) معالجة الطلبات المعلقة الموجودة حالياً وإضافتها لقائمة الانتظار

-- الطلبات العادية
UPDATE orders SET status = 'processing' WHERE status = 'pending';

INSERT INTO driver_waiting_list (
  order_id, vendor_id, customer_name, customer_phone,
  address, city, total, notes, payment_method,
  preparation_time, actual_preparation_time,
  preparation_start, preparation_end,
  order_number, vendor_name, items_data,
  geocoded_latitude, geocoded_longitude,
  vendor_geocoded_latitude, vendor_geocoded_longitude,
  status, created_at, expires_at
)
SELECT
  o.id, o.vendor_id, o.customer_name, o.customer_phone,
  o.address, o.city, o.total, o.notes, COALESCE(o.payment_method, 'cash'),
  o.preparation_time, o.actual_preparation_time,
  o.preparation_start, o.preparation_end,
  o.order_number, v.store_name, o.items_data,
  o.geocoded_latitude, o.geocoded_longitude,
  v.latitude, v.longitude,
  'pending', now(), NOW() + INTERVAL '365 days'
FROM orders o
LEFT JOIN vendors v ON v.id = o.vendor_id
WHERE o.status = 'processing'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id);

-- طلبات الكابتن
UPDATE captain_orders SET status = 'processing' WHERE status = 'pending';

INSERT INTO driver_waiting_list (
  captain_order_id, vendor_id, customer_name, customer_phone,
  address, total, notes, order_number,
  status, created_at, expires_at
)
SELECT
  co.id, NULL, co.customer_name, co.customer_phone,
  co.pickup_address, COALESCE(co.delivery_fee, 0), co.notes, co.order_number,
  'pending', now(), NOW() + INTERVAL '365 days'
FROM captain_orders co
WHERE co.status = 'processing'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.captain_order_id = co.id);

-- طلبات الطرود
UPDATE parcel_orders SET status = 'processing' WHERE status = 'pending';

INSERT INTO driver_waiting_list (
  parcel_order_id, vendor_id, customer_name, customer_phone,
  address, city, total, notes, order_number,
  geocoded_latitude, geocoded_longitude,
  status, created_at, expires_at
)
SELECT
  po.id, NULL, po.sender_name, po.sender_phone,
  po.sender_address, po.receiver_address, COALESCE(po.delivery_fee, 0),
  COALESCE(po.description, po.notes), po.order_number,
  po.sender_latitude, po.sender_longitude,
  'pending', now(), NOW() + INTERVAL '365 days'
FROM parcel_orders po
WHERE po.status = 'processing'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = po.id);