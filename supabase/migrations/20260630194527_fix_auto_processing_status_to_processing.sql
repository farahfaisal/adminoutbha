
-- عند تفعيل المعالجة التلقائية:
-- الطلب يصبح بحالة processing (قيد التحضير) ويُضاف لقائمة انتظار السائقين

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
    NEW.status := 'processing';
  END IF;
  
  RETURN NEW;
END;
$$;

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
  
  IF v_auto_processing AND NEW.status = 'processing' THEN
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

-- تحديث الإعدادات لتعكس الحالة الصحيحة
UPDATE app_settings
SET settings = jsonb_set(
  jsonb_set(settings, '{orders,autoProcessing}', 'true'),
  '{orders,autoProcessingStatus}',
  '"processing"'
);
