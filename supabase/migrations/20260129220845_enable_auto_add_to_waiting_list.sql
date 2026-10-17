/*
  # تفعيل الإضافة التلقائية إلى قائمة انتظار السائقين

  1. التغييرات
    - تعديل دالة auto_process_new_order لتقوم بحالتين معاً:
      * تحويل الطلب إلى processing
      * إضافة الطلب إلى driver_waiting_list تلقائياً
    
  2. السلوك الجديد
    - عند تفعيل المعالجة التلقائية:
      * الطلب يتحول من pending إلى processing
      * يُضاف تلقائياً إلى قائمة انتظار السائقين
      * السائقون يستطيعون رؤية الطلب فوراً
    
  3. الفوائد
    - سرعة أكبر في معالجة الطلبات
    - السائقون يحصلون على الطلبات مباشرة
    - لا حاجة لخطوة يدوية إضافية
*/

-- تحديث دالة المعالجة التلقائية لتضيف إلى قائمة الانتظار أيضاً
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_has_status_history BOOLEAN;
  v_vendor_id UUID;
  v_pickup_lat DECIMAL;
  v_pickup_lng DECIMAL;
  v_total DECIMAL;
BEGIN
  -- الحصول على كامل الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- تحويل الطلب إلى processing
    NEW.status := 'processing';
    NEW.updated_at := now();
    
    -- الحصول على معلومات الطلب
    IF TG_TABLE_NAME = 'orders' THEN
      v_vendor_id := NEW.vendor_id;
      v_total := NEW.total;
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      v_vendor_id := NULL;
      v_total := NEW.total;
      v_pickup_lat := NEW.pickup_latitude;
      v_pickup_lng := NEW.pickup_longitude;
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      v_vendor_id := NULL;
      v_total := NEW.total;
      v_pickup_lat := NEW.pickup_latitude;
      v_pickup_lng := NEW.pickup_longitude;
    END IF;
    
    -- التحقق من وجود حقل status_history في الجدول
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = TG_TABLE_NAME 
      AND column_name = 'status_history'
    ) INTO v_has_status_history;
    
    -- إضافة سجل في سجل الحالات إذا كان الحقل موجوداً
    IF v_has_status_history THEN
      IF TG_TABLE_NAME = 'parcel_orders' THEN
        NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || 
          jsonb_build_object(
            'status', 'processing',
            'timestamp', now(),
            'note', 'تم القبول تلقائياً وجاري التحضير - تمت الإضافة لقائمة السائقين'
          );
      END IF;
    END IF;
    
    -- إضافة سجل في order_status_history (للطلبات العادية فقط)
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (order_id, status, note, created_at)
      VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً وجاري التحضير - تمت الإضافة لقائمة السائقين',
        now()
      );
    END IF;
    
    -- إضافة الطلب إلى driver_waiting_list بعد الـ INSERT
    -- سيتم تنفيذ هذا في AFTER INSERT trigger منفصل
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- دالة لإضافة الطلبات المعالجة تلقائياً إلى driver_waiting_list
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
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
      )
      ON CONFLICT (order_id) DO NOTHING;
      
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
      )
      ON CONFLICT (captain_order_id) DO NOTHING;
      
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- طلبات طرود
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
        NEW.total,
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

-- إزالة الـ triggers القديمة
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;

DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;
DROP TRIGGER IF EXISTS auto_add_captain_to_waiting_list_trigger ON captain_orders;
DROP TRIGGER IF EXISTS auto_add_parcel_to_waiting_list_trigger ON parcel_orders;

-- إضافة BEFORE INSERT triggers لتغيير الحالة
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

-- إضافة AFTER INSERT triggers للإضافة إلى driver_waiting_list
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
