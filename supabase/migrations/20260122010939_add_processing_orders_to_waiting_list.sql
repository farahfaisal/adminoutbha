/*
  # إضافة الطلبات بحالة processing إلى قائمة انتظار السائقين

  1. الوظيفة
    - تحديث حالة الطلبات من 'processing' إلى 'waiting-for-driver'
    - إضافة الطلبات إلى driver_waiting_list
    
  2. دالة جديدة
    - `move_processing_orders_to_waiting_list`: دالة لنقل الطلبات يدوياً
*/

-- إضافة الطلبات بحالة processing إلى driver_waiting_list وتحديث حالتها
DO $$
DECLARE
  v_order RECORD;
BEGIN
  -- المرور على كل طلب بحالة processing
  FOR v_order IN 
    SELECT id, vendor_id, created_at, updated_at 
    FROM orders 
    WHERE status = 'processing'
  LOOP
    -- تحديث حالة الطلب
    UPDATE orders
    SET 
      status = 'waiting-for-driver',
      updated_at = now()
    WHERE id = v_order.id;
    
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      status,
      created_at
    ) VALUES (
      v_order.id,
      v_order.vendor_id,
      'pending',
      COALESCE(v_order.updated_at, v_order.created_at)
    )
    ON CONFLICT (order_id) DO NOTHING;
  END LOOP;
END $$;

-- إنشاء دالة لنقل الطلبات من processing إلى waiting-for-driver
CREATE OR REPLACE FUNCTION move_processing_orders_to_waiting_list()
RETURNS TABLE (
  orders_moved INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_order RECORD;
BEGIN
  -- المرور على كل طلب بحالة processing أو pending
  FOR v_order IN 
    SELECT id, vendor_id, created_at, updated_at 
    FROM orders 
    WHERE status IN ('processing', 'pending')
  LOOP
    -- تحديث حالة الطلب
    UPDATE orders
    SET 
      status = 'waiting-for-driver',
      updated_at = now()
    WHERE id = v_order.id;
    
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      status,
      created_at
    ) VALUES (
      v_order.id,
      v_order.vendor_id,
      'pending',
      now()
    )
    ON CONFLICT (order_id) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION move_processing_orders_to_waiting_list() TO authenticated;
GRANT EXECUTE ON FUNCTION move_processing_orders_to_waiting_list() TO anon;