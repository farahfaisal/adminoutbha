/*
  # تعديل المعالجة التلقائية لتحويل الطلبات إلى processing فقط

  1. التغييرات
    - تعديل دالة auto_process_new_order لتحويل الطلبات إلى 'processing' فقط
    - إزالة الإضافة التلقائية إلى driver_waiting_list
    - الاحتفاظ بالـ triggers اليدوية التي تضيف الطلبات عندما يتم تحويلها يدوياً إلى 'waiting-for-driver'

  2. السلوك الجديد
    - المعالجة التلقائية: pending → processing (بدون إضافة إلى driver_waiting_list)
    - التحويل اليدوي: processing → waiting-for-driver (تتم الإضافة إلى driver_waiting_list تلقائياً)
    - المسؤول يتحكم بموعد إضافة الطلب إلى قائمة السائقين
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
  v_has_status_history BOOLEAN;
BEGIN
  -- الحصول على كامل الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- تحويل الطلب إلى processing فقط
    NEW.status := 'processing';
    NEW.updated_at := now();
    
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
            'note', 'تم القبول تلقائياً وجاري التحضير'
          );
      END IF;
    END IF;
    
    -- إضافة سجل في order_status_history (للطلبات العادية فقط)
    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (order_id, status, note, created_at)
      VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً وجاري التحضير',
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- التأكد من تطبيق الدالة على جميع جداول الطلبات
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();