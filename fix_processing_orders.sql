-- ============================================
-- إضافة الطلبات الموجودة في حالة processing إلى قائمة انتظار السائقين
-- نفذ هذا الملف في Supabase SQL Editor
-- ============================================

-- الجزء 1: إضافة الطلبات الموجودة حالياً
-- ============================================

-- 1. إضافة جميع الطلبات العادية في حالة processing
INSERT INTO driver_waiting_list (
  order_id,
  vendor_id,
  total,
  status,
  created_at
)
SELECT
  o.id,
  o.vendor_id,
  COALESCE(o.total, 0),
  'pending',
  o.created_at
FROM orders o
WHERE o.status = 'processing'
  AND o.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.order_id = o.id
  )
ON CONFLICT (order_id) DO NOTHING;

-- 2. إضافة جميع طلبات الكابتن في حالة processing
INSERT INTO driver_waiting_list (
  captain_order_id,
  vendor_id,
  total,
  status,
  created_at,
  geocoded_latitude,
  geocoded_longitude
)
SELECT
  co.id,
  NULL,
  COALESCE(co.total, 0),
  'pending',
  co.created_at,
  co.pickup_latitude,
  co.pickup_longitude
FROM captain_orders co
WHERE co.status = 'processing'
  AND co.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.captain_order_id = co.id
  )
ON CONFLICT (captain_order_id) DO NOTHING;

-- 3. إضافة جميع طلبات الطرود في حالة processing
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
  COALESCE(po.total, 0),
  'pending',
  po.created_at,
  po.pickup_latitude,
  po.pickup_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
  AND po.driver_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM driver_waiting_list dwl
    WHERE dwl.parcel_order_id = po.id
  )
ON CONFLICT (parcel_order_id) DO NOTHING;


-- ============================================
-- الجزء 2: إضافة Triggers لالتحويلات اليدوية
-- ============================================

-- دالة لإضافة الطلبات عند تحويلها يدوياً إلى processing
CREATE OR REPLACE FUNCTION add_manual_processing_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
BEGIN
  -- الحصول على الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);

  -- إذا كانت المعالجة التلقائية مفعلة وتم تحويل الطلب يدوياً إلى processing
  IF v_auto_processing
     AND OLD.status != 'processing'
     AND NEW.status = 'processing'
     AND NEW.driver_id IS NULL THEN

    -- إضافة إلى driver_waiting_list حسب نوع الطلب
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
        COALESCE(NEW.total, 0),
        'pending',
        now()
      )
      ON CONFLICT (order_id) DO NOTHING;

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
        COALESCE(NEW.total, 0),
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      )
      ON CONFLICT (captain_order_id) DO NOTHING;

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
        COALESCE(NEW.total, 0),
        'pending',
        now(),
        NEW.pickup_latitude,
        NEW.pickup_longitude
      )
      ON CONFLICT (parcel_order_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- إزالة الـ triggers القديمة على UPDATE إن وجدت
DROP TRIGGER IF EXISTS add_manual_processing_trigger ON orders;
DROP TRIGGER IF EXISTS add_manual_captain_processing_trigger ON captain_orders;
DROP TRIGGER IF EXISTS add_manual_parcel_processing_trigger ON parcel_orders;

-- إضافة AFTER UPDATE triggers لالتقاط التحويلات اليدوية
CREATE TRIGGER add_manual_processing_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();

CREATE TRIGGER add_manual_captain_processing_trigger
  AFTER UPDATE OF status ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();

CREATE TRIGGER add_manual_parcel_processing_trigger
  AFTER UPDATE OF status ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_manual_processing_to_waiting_list();
