
-- إصلاح الطلبات التي نُقلت خطأً إلى waiting-for-driver بدلاً من processing

UPDATE orders
SET status = 'processing'
WHERE status = 'waiting-for-driver'
  AND EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = orders.id
  );

UPDATE parcel_orders
SET status = 'processing'
WHERE status = 'waiting-for-driver'
  AND EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.parcel_order_id = parcel_orders.id
  );

UPDATE captain_orders
SET status = 'processing'
WHERE status = 'waiting-for-driver'
  AND EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.captain_order_id = captain_orders.id
  );
