/*
  # تحديث نظام المعالجة التلقائية للطلبات

  1. التحديثات
    - تحديث دالة `auto_process_new_order` لإضافة الطلبات إلى driver_waiting_list
    - إضافة الطلبات تلقائياً عند وصولها لحالة 'waiting-for-driver'

  2. الوظيفة
    - عند إنشاء طلب جديد وتفعيل المعالجة التلقائية
    - تغيير الحالة وإضافة الطلب إلى driver_waiting_list تلقائياً
*/

-- تحديث دالة المعالجة التلقائية
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_target_status TEXT;
BEGIN
  -- الحصول على كامل الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- الحصول على الحالة المستهدفة
    v_target_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'waiting-for-driver');
    
    -- تحديث حالة الطلب
    NEW.status := v_target_status;
    NEW.updated_at := now();
    
    -- إضافة سجل في سجل الحالات إذا كان الجدول يحتوي على حقل status_history
    IF TG_TABLE_NAME = 'orders' OR TG_TABLE_NAME = 'parcel_orders' THEN
      IF NEW.status_history IS NOT NULL THEN
        NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || 
          jsonb_build_object(
            'status', v_target_status,
            'timestamp', now(),
            'note', 'تم القبول تلقائياً'
          );
      END IF;
    END IF;
    
    -- إضافة إلى driver_waiting_list إذا كانت الحالة المستهدفة 'waiting-for-driver'
    -- وكان الجدول orders (الطلبات العادية فقط)
    IF v_target_status = 'waiting-for-driver' AND TG_TABLE_NAME = 'orders' THEN
      -- استخدام INSERT مع ON CONFLICT لتجنب الأخطاء
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        'pending',
        now()
      )
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ triggers
DROP TRIGGER IF EXISTS trigger_auto_process_order ON orders;
CREATE TRIGGER trigger_auto_process_order
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS trigger_auto_process_captain_order ON captain_orders;
CREATE TRIGGER trigger_auto_process_captain_order
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS trigger_auto_process_parcel_order ON parcel_orders;
CREATE TRIGGER trigger_auto_process_parcel_order
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- إضافة constraint لمنع التكرار في driver_waiting_list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_waiting_list_order_id_key'
  ) THEN
    ALTER TABLE driver_waiting_list 
    ADD CONSTRAINT driver_waiting_list_order_id_key 
    UNIQUE (order_id);
  END IF;
END $$;