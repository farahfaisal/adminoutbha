/*
  # إصلاح حساب المبلغ الإجمالي للطلبات
  
  ## المشكلة
  - order_items.total يُحسب بشكل صحيح (سعر المنتج × الكمية + الإضافات)
  - لكن orders.subtotal لا يتم تحديثه تلقائياً من مجموع order_items.total
  - هذا يسبب اختلاف بين المبالغ المحسوبة والمعروضة
  
  ## الحل
  1. إنشاء function لحساب subtotal من order_items
  2. إنشاء trigger يحدّث orders.subtotal تلقائياً عند:
     - إضافة order_item جديد
     - تعديل order_item موجود
     - حذف order_item
  3. إعادة حساب جميع الطلبات الموجودة
  
  ## الحساب الصحيح
  - orders.subtotal = SUM(order_items.total)
  - orders.total = subtotal + delivery_fee - points_discount - coupon_discount
*/

-- حذف التريجر القديم إن وجد
DROP TRIGGER IF EXISTS update_order_subtotal_trigger ON order_items;
DROP FUNCTION IF EXISTS update_order_subtotal();

-- إنشاء function لتحديث subtotal للطلب
CREATE OR REPLACE FUNCTION update_order_subtotal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_new_subtotal numeric;
BEGIN
  -- تحديد order_id المتأثر
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- حساب subtotal الجديد من مجموع order_items.total
  SELECT COALESCE(SUM(total), 0)
  INTO v_new_subtotal
  FROM order_items
  WHERE order_id = v_order_id;

  -- تحديث subtotal في orders
  UPDATE orders
  SET 
    subtotal = v_new_subtotal,
    updated_at = NOW()
  WHERE id = v_order_id;

  -- إرجاع السجل المناسب
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- إنشاء trigger على order_items
CREATE TRIGGER update_order_subtotal_trigger
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_subtotal();

-- إعادة حساب subtotal لجميع الطلبات الموجودة
UPDATE orders o
SET subtotal = (
  SELECT COALESCE(SUM(oi.total), 0)
  FROM order_items oi
  WHERE oi.order_id = o.id
)
WHERE EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
);

-- عرض الطلبات التي تم تصحيحها
DO $$
DECLARE
  v_corrected_count integer;
BEGIN
  SELECT COUNT(*) INTO v_corrected_count
  FROM orders o
  WHERE EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id);
  
  RAISE NOTICE '✅ تم إعادة حساب % طلب', v_corrected_count;
END $$;