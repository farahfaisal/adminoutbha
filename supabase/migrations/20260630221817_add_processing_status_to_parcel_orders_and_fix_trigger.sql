
-- إضافة 'processing' لقيد الحالات في parcel_orders
ALTER TABLE parcel_orders DROP CONSTRAINT IF EXISTS parcel_orders_status_check;
ALTER TABLE parcel_orders ADD CONSTRAINT parcel_orders_status_check 
  CHECK (status = ANY (ARRAY[
    'pending', 'pending_review', 'processing', 'accepted',
    'picked_up', 'in_transit', 'delivered', 'cancelled', 'rejected'
  ]));

-- الآن إصلاح الطلب الحالي
UPDATE parcel_orders
SET status = 'processing'
WHERE order_number = 'PAR-20260630-9154';

-- إضافته لقائمة انتظار السائقين
INSERT INTO driver_waiting_list (parcel_order_id, vendor_id, total, status, created_at, geocoded_latitude, geocoded_longitude)
SELECT po.id, NULL, po.delivery_fee, 'pending', now(), po.sender_latitude, po.sender_longitude
FROM parcel_orders po
WHERE po.order_number = 'PAR-20260630-9154'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = po.id);

-- معالجة باقي طلبات الطرود pending_review
UPDATE parcel_orders SET status = 'processing' WHERE status = 'pending_review';

INSERT INTO driver_waiting_list (parcel_order_id, vendor_id, total, status, created_at, geocoded_latitude, geocoded_longitude)
SELECT po.id, NULL, po.delivery_fee, 'pending', now(), po.sender_latitude, po.sender_longitude
FROM parcel_orders po
WHERE po.status = 'processing'
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = po.id);
