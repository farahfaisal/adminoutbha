/*
  # تحديث دالة معالجة الطلبات دفعة واحدة

  1. التحديثات
    - تحديث `batch_process_existing_orders` لإضافة الطلبات إلى driver_waiting_list
    - التعامل مع captain_orders و parcel_orders أيضاً

  2. الوظيفة
    - عند تحديث حالة الطلب إلى 'waiting-for-driver'
    - إضافة الطلب إلى جدول driver_waiting_list
    - تجنب التكرار (تخطي الطلبات الموجودة بالفعل في القائمة)
*/

-- تحديث دالة معالجة الطلبات لإضافتها إلى driver_waiting_list
CREATE OR REPLACE FUNCTION batch_process_existing_orders(
  p_target_status TEXT DEFAULT 'waiting-for-driver',
  p_from_statuses TEXT[] DEFAULT ARRAY['pending', 'processing']
)
RETURNS TABLE (
  orders_count INT,
  captain_orders_count INT,
  parcel_orders_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders_count INT := 0;
  v_captain_orders_count INT := 0;
  v_parcel_orders_count INT := 0;
  v_timestamp TIMESTAMPTZ := now();
  v_order RECORD;
BEGIN
  -- معالجة الطلبات العادية
  FOR v_order IN 
    SELECT id, vendor_id FROM orders 
    WHERE status = ANY(p_from_statuses)
  LOOP
    -- تحديث حالة الطلب
    UPDATE orders
    SET 
      status = p_target_status,
      updated_at = v_timestamp,
      status_history = COALESCE(status_history, '[]'::jsonb) || 
        jsonb_build_object(
          'status', p_target_status,
          'timestamp', v_timestamp,
          'note', 'تم القبول تلقائياً عبر المعالجة الجماعية'
        )
    WHERE id = v_order.id;
    
    -- إضافة إلى driver_waiting_list إذا لم يكن موجوداً
    IF p_target_status = 'waiting-for-driver' AND 
       NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = v_order.id) THEN
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        status,
        created_at
      ) VALUES (
        v_order.id,
        v_order.vendor_id,
        'pending',
        v_timestamp
      );
    END IF;
    
    v_orders_count := v_orders_count + 1;
  END LOOP;
  
  -- معالجة طلبات الكابتن
  FOR v_order IN 
    SELECT id, vendor_id FROM captain_orders 
    WHERE status = ANY(p_from_statuses)
  LOOP
    UPDATE captain_orders
    SET 
      status = p_target_status,
      updated_at = v_timestamp
    WHERE id = v_order.id;
    
    v_captain_orders_count := v_captain_orders_count + 1;
  END LOOP;
  
  -- معالجة طلبات الطرود
  FOR v_order IN 
    SELECT id, vendor_id FROM parcel_orders 
    WHERE status = ANY(p_from_statuses)
  LOOP
    UPDATE parcel_orders
    SET 
      status = p_target_status,
      updated_at = v_timestamp,
      status_history = COALESCE(status_history, '[]'::jsonb) || 
        jsonb_build_object(
          'status', p_target_status,
          'timestamp', v_timestamp,
          'note', 'تم القبول تلقائياً عبر المعالجة الجماعية'
        )
    WHERE id = v_order.id;
    
    v_parcel_orders_count := v_parcel_orders_count + 1;
  END LOOP;
  
  -- إرجاع النتائج
  RETURN QUERY SELECT v_orders_count, v_captain_orders_count, v_parcel_orders_count;
END;
$$;