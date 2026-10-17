/*
  # إضافة نظام المعالجة التلقائية للطلبات

  1. الدوال
    - `get_app_setting` - للحصول على إعداد معين من الإعدادات
    - `auto_process_new_order` - للمعالجة التلقائية للطلبات الجديدة

  2. الـ Triggers
    - trigger للطلبات العادية (orders)
    - trigger لطلبات الكابتن (captain_orders)
    - trigger لطلبات الطرود (parcel_orders)

  3. الوظيفة
    - عند إضافة طلب جديد بحالة 'pending'
    - يتحقق من تفعيل المعالجة التلقائية
    - يُغير الحالة تلقائياً إلى الحالة المحددة في الإعدادات
*/

-- دالة للحصول على قيمة إعداد معين
CREATE OR REPLACE FUNCTION get_app_setting(p_path TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_result JSONB;
BEGIN
  -- الحصول على كامل الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  IF v_settings IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- استخراج القيمة باستخدام المسار
  -- مثال: 'orders.autoProcessing' يصبح jsonb_extract_path
  EXECUTE format('SELECT $1#>%L', string_to_array(p_path, '.'))
  INTO v_result
  USING v_settings;
  
  RETURN v_result;
END;
$$;

-- دالة للمعالجة التلقائية للطلبات
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة trigger للطلبات العادية
DROP TRIGGER IF EXISTS trigger_auto_process_order ON orders;
CREATE TRIGGER trigger_auto_process_order
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- إضافة trigger لطلبات الكابتن
DROP TRIGGER IF EXISTS trigger_auto_process_captain_order ON captain_orders;
CREATE TRIGGER trigger_auto_process_captain_order
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- إضافة trigger لطلبات الطرود
DROP TRIGGER IF EXISTS trigger_auto_process_parcel_order ON parcel_orders;
CREATE TRIGGER trigger_auto_process_parcel_order
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

-- تحديث الإعدادات لإضافة قسم orders إذا لم يكن موجوداً
DO $$
DECLARE
  v_settings JSONB;
  v_settings_id UUID;
BEGIN
  SELECT id, settings INTO v_settings_id, v_settings FROM app_settings LIMIT 1;
  
  IF v_settings_id IS NOT NULL AND (v_settings->'orders' IS NULL) THEN
    UPDATE app_settings
    SET settings = settings || jsonb_build_object(
      'orders', jsonb_build_object(
        'autoProcessing', false,
        'autoProcessingStatus', 'waiting-for-driver',
        'defaultPreparationTime', 15,
        'notifyDrivers', true,
        'autoUpdateStatus', true
      )
    )
    WHERE id = v_settings_id;
  END IF;
END $$;