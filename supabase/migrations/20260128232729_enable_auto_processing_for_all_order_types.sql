/*
  # تفعيل المعالجة التلقائية لجميع أنواع الطلبات

  1. التغييرات
    - تحديث دالة auto_process_new_order لتشمل captain_orders و parcel_orders
    - إضافة طلبات الكابتن والطرود إلى driver_waiting_list عند المعالجة التلقائية
    
  2. الوظيفة
    - عند إنشاء طلب جديد (orders, captain_orders, parcel_orders):
      * إذا كانت المعالجة التلقائية مفعّلة
      * تغيير حالة الطلب من "pending" إلى الحالة المستهدفة (waiting-for-driver)
      * إضافة الطلب إلى driver_waiting_list
      
  3. الفوائد
    - معالجة موحدة لجميع أنواع الطلبات
    - تسهيل تعيين السائقين لجميع أنواع الطلبات
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
  v_vendor_id UUID;
  v_latitude NUMERIC;
  v_longitude NUMERIC;
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
      -- تحديث status_history لطلبات الطرود فقط (لأنها تحتوي على حقل status_history)
      IF TG_TABLE_NAME = 'parcel_orders' THEN
        NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || 
          jsonb_build_object(
            'status', v_target_status,
            'timestamp', now(),
            'note', 'تم القبول تلقائياً'
          );
      END IF;
    END IF;
    
    -- إضافة إلى driver_waiting_list للحالة المستهدفة 'waiting-for-driver'
    -- يعمل على جميع أنواع الطلبات (orders, captain_orders, parcel_orders)
    IF v_target_status = 'waiting-for-driver' THEN
      -- الحصول على vendor_id والإحداثيات حسب نوع الطلب
      IF TG_TABLE_NAME = 'orders' THEN
        v_vendor_id := NEW.vendor_id;
        v_latitude := NEW.latitude;
        v_longitude := NEW.longitude;
      ELSIF TG_TABLE_NAME = 'captain_orders' THEN
        v_vendor_id := NULL; -- طلبات الكابتن ليس لها vendor
        v_latitude := NEW.pickup_latitude;
        v_longitude := NEW.pickup_longitude;
      ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
        v_vendor_id := NULL; -- طلبات الطرود ليس لها vendor
        v_latitude := NEW.pickup_latitude;
        v_longitude := NEW.pickup_longitude;
      END IF;
      
      -- إضافة إلى driver_waiting_list
      -- استخدام INSERT مع ON CONFLICT للطلبات العادية
      -- بالنسبة لطلبات الكابتن والطرود، نستخدم order_id مختلف
      IF TG_TABLE_NAME = 'orders' THEN
        INSERT INTO driver_waiting_list (
          order_id,
          vendor_id,
          status,
          created_at,
          geocoded_latitude,
          geocoded_longitude
        ) VALUES (
          NEW.id,
          v_vendor_id,
          'pending',
          now(),
          v_latitude,
          v_longitude
        )
        ON CONFLICT (order_id) DO NOTHING;
      ELSIF TG_TABLE_NAME = 'captain_orders' THEN
        INSERT INTO driver_waiting_list (
          captain_order_id,
          vendor_id,
          status,
          created_at,
          geocoded_latitude,
          geocoded_longitude
        ) VALUES (
          NEW.id,
          v_vendor_id,
          'pending',
          now(),
          v_latitude,
          v_longitude
        )
        ON CONFLICT (captain_order_id) DO NOTHING;
      ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
        INSERT INTO driver_waiting_list (
          parcel_order_id,
          vendor_id,
          status,
          created_at,
          geocoded_latitude,
          geocoded_longitude
        ) VALUES (
          NEW.id,
          v_vendor_id,
          'pending',
          now(),
          v_latitude,
          v_longitude
        )
        ON CONFLICT (parcel_order_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;