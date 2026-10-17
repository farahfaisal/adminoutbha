/*
  # إصلاح نظام قائمة الانتظار - بدون إحداثيات للكابتن

  1. الهدف
    - حذف جميع الـ triggers القديمة
    - إعادة إنشاء النظام بشكل صحيح
    - استخدام delivery_fee بدلاً من total لطلبات الكابتن والطرود
    - إضافة الطلبات الموجودة إلى القائمة
  
  2. ملاحظات
    - orders: لديه total + vendor_id
    - captain_orders: لديه delivery_fee فقط
    - parcel_orders: لديه delivery_fee + sender coordinates
*/

-- حذف جميع الـ triggers القديمة
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;
DROP TRIGGER IF EXISTS auto_add_captain_to_waiting_list_trigger ON captain_orders;
DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;
DROP TRIGGER IF EXISTS trigger_add_to_waiting_list_on_update ON orders;
DROP TRIGGER IF EXISTS trigger_add_captain_to_waiting_list_on_update ON captain_orders;
DROP TRIGGER IF EXISTS trigger_add_parcel_to_waiting_list_on_update ON parcel_orders;

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS add_to_waiting_list_on_status_change() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_order_status_on_waiting_list() CASCADE;

-- دالة المعالجة التلقائية - BEFORE INSERT
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_has_status_history BOOLEAN;
BEGIN
  -- الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- تحويل الطلب إلى processing
    NEW.status := 'processing';
    NEW.updated_at := now();
    
    -- التحقق من وجود حقل status_history
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = TG_TABLE_NAME 
      AND column_name = 'status_history'
    ) INTO v_has_status_history;
    
    -- إضافة سجل في status_history إذا كان موجوداً
    IF v_has_status_history AND TG_TABLE_NAME IN ('parcel_orders', 'captain_orders') THEN
      NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || 
        jsonb_build_object(
          'status', 'processing',
          'timestamp', now(),
          'note', 'تم القبول تلقائياً - جاري التحضير'
        );
    END IF;
    
    -- إضافة سجل في order_status_history (للطلبات العادية)
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (order_id, status, note, created_at)
      VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً - جاري التحضير',
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- دالة الإضافة إلى driver_waiting_list - AFTER INSERT
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_exists BOOLEAN;
BEGIN
  -- الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب في حالة processing
  IF v_auto_processing AND NEW.status = 'processing' THEN
    IF TG_TABLE_NAME = 'orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          order_id, vendor_id, total, status, created_at
        ) VALUES (
          NEW.id, NEW.vendor_id, NEW.total, 'pending', now()
        );
      END IF;
      
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          captain_order_id, vendor_id, total, status, created_at
        ) VALUES (
          NEW.id, NULL, NEW.delivery_fee, 'pending', now()
        );
      END IF;
      
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          parcel_order_id, vendor_id, total, status, created_at,
          geocoded_latitude, geocoded_longitude
        ) VALUES (
          NEW.id, NULL, NEW.delivery_fee, 'pending', now(),
          NEW.sender_latitude, NEW.sender_longitude
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء BEFORE INSERT triggers
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- إنشاء AFTER INSERT triggers
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

CREATE TRIGGER auto_add_captain_to_waiting_list_trigger
  AFTER INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

CREATE TRIGGER auto_add_parcel_to_waiting_list_trigger
  AFTER INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- إضافة الطلبات الموجودة بحالة processing إلى القائمة
INSERT INTO driver_waiting_list (
  order_id, vendor_id, total, status, created_at
)
SELECT 
  o.id, o.vendor_id, o.total, 'pending', now()
FROM orders o
WHERE o.status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  );

INSERT INTO driver_waiting_list (
  captain_order_id, vendor_id, total, status, created_at
)
SELECT 
  co.id, NULL, co.delivery_fee, 'pending', now()
FROM captain_orders co
WHERE co.status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.captain_order_id = co.id
  );

INSERT INTO driver_waiting_list (
  parcel_order_id, vendor_id, total, status, created_at,
  geocoded_latitude, geocoded_longitude
)
SELECT 
  po.id, NULL, po.delivery_fee, 'pending', now(),
  po.sender_latitude, po.sender_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = po.id
  );
