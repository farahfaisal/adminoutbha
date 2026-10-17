/*
  # إصلاح دالة المعالجة التلقائية

  1. التغييرات
    - إصلاح التحقق من وجود حقل status_history
    - استخدام التحقق الديناميكي بدلاً من الافتراض بوجود الحقل
    
  2. الوظيفة
    - تعمل مع جميع الجداول سواء كان لديها status_history أم لا
*/

CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_target_status TEXT;
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
    -- الحصول على الحالة المستهدفة
    v_target_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'waiting-for-driver');
    
    -- تحديث حالة الطلب
    NEW.status := v_target_status;
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
      EXECUTE format(
        'SELECT ($1).%I IS NOT NULL',
        'status_history'
      ) USING NEW;
      
      -- تحديث status_history
      IF TG_TABLE_NAME = 'parcel_orders' THEN
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
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        status,
        created_at,
        geocoded_latitude,
        geocoded_longitude
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        'pending',
        now(),
        NEW.latitude,
        NEW.longitude
      )
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;