/*
  # إصلاح مباشر للطلبات في processing

  1. الحل
    - تحديث الطلبات مباشرة مع تسجيل في order_status_history
    - إضافتهم إلى driver_waiting_list
*/

-- تحديث الطلبات مباشرة
DO $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN 
    SELECT id, vendor_id, latitude, longitude, order_number
    FROM orders
    WHERE id IN (
      '2013159c-ecfd-4ca7-b621-0cfdc958e611',
      '516f9ff9-b732-4ace-a062-f26036bf2fb3'
    )
  LOOP
    -- تحديث الحالة
    UPDATE orders
    SET 
      status = 'waiting-for-driver',
      updated_at = now()
    WHERE id = v_order.id;
    
    -- إضافة سجل في order_status_history
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      v_order.id,
      'waiting-for-driver',
      'تم تصحيح الحالة من processing إلى waiting-for-driver',
      '00000000-0000-0000-0000-000000000000'::uuid
    );
    
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude
    ) VALUES (
      v_order.id,
      v_order.vendor_id,
      'pending',
      now(),
      v_order.latitude,
      v_order.longitude
    )
    ON CONFLICT (order_id) DO NOTHING;
    
    RAISE NOTICE 'تم تحديث الطلب: %', v_order.order_number;
  END LOOP;
END $$;