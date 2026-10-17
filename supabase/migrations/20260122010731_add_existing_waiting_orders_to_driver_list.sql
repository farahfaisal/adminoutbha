/*
  # إضافة الطلبات الموجودة بحالة waiting-for-driver إلى قائمة انتظار السائقين

  1. الوظيفة
    - إضافة جميع الطلبات الموجودة بحالة 'waiting-for-driver' إلى driver_waiting_list
    - تجنب التكرار (تخطي الطلبات الموجودة بالفعل)
    
  2. الطلبات المشمولة
    - orders (الطلبات العادية)
    - captain_orders (طلبات الكابتن)
    - parcel_orders (طلبات الطرود)
*/

-- إضافة جميع الطلبات العادية بحالة waiting-for-driver إلى driver_waiting_list
INSERT INTO driver_waiting_list (
  order_id,
  vendor_id,
  status,
  created_at
)
SELECT 
  o.id,
  o.vendor_id,
  'pending',
  COALESCE(o.updated_at, o.created_at)
FROM orders o
WHERE o.status = 'waiting-for-driver'
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl 
    WHERE dwl.order_id = o.id
  )
ON CONFLICT (order_id) DO NOTHING;