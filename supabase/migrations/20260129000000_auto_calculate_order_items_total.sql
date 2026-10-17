/*
  # إصلاح نهائي: حساب total تلقائياً في order_items

  1. المشكلة
    - الطلبات الجديدة تحتوي على total = 0 في order_items
    - هذا يجعل المبلغ الإجمالي يظهر بشكل خاطئ (رسوم التوصيل فقط)

  2. الحل
    - إنشاء trigger يحسب total تلقائياً عند الإدراج أو التحديث
    - يحسب: total = (price × quantity) + sum(addon prices)
    - إصلاح جميع البيانات الموجودة التي لها total = 0

  3. الصيغة الصحيحة
    - السعر الأساسي: price × quantity
    - الإضافات: sum(addon.price × addon.quantity) بدون ضرب في quantity المنتج
    - المجموع: baseTotal + addonsTotal

  4. الأمان
    - لا تغييرات في RLS
    - Trigger يعمل BEFORE INSERT/UPDATE
*/

-- إنشاء أو استبدال الدالة calculate_order_item_total إذا لم تكن موجودة
CREATE OR REPLACE FUNCTION calculate_order_item_total(
  p_price numeric,
  p_quantity integer,
  p_addons_data jsonb DEFAULT '[]'::jsonb
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_total numeric;
  addons_total numeric := 0;
  addon jsonb;
BEGIN
  -- حساب السعر الأساسي
  base_total := p_price * p_quantity;

  -- حساب مجموع الإضافات
  IF p_addons_data IS NOT NULL AND jsonb_array_length(p_addons_data) > 0 THEN
    FOR addon IN SELECT * FROM jsonb_array_elements(p_addons_data)
    LOOP
      -- كل إضافة × كميتها، بدون ضرب في كمية المنتج
      addons_total := addons_total + (
        COALESCE((addon->>'price')::numeric, 0) *
        COALESCE((addon->>'quantity')::integer, 1)
      );
    END LOOP;
  END IF;

  RETURN base_total + addons_total;
END;
$$;

-- إنشاء دالة trigger لتحديث total تلقائياً
CREATE OR REPLACE FUNCTION auto_calculate_order_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- إذا كان total = 0 أو NULL، احسبه تلقائياً
  IF NEW.total IS NULL OR NEW.total = 0 THEN
    NEW.total := calculate_order_item_total(
      NEW.price,
      NEW.quantity,
      NEW.addons_data
    );
  END IF;

  RETURN NEW;
END;
$$;

-- حذف trigger القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS auto_calculate_order_item_total_trigger ON order_items;

-- إنشاء trigger جديد
CREATE TRIGGER auto_calculate_order_item_total_trigger
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_order_item_total();

-- إصلاح جميع order_items الموجودة التي لها total = 0
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE total = 0 OR total IS NULL;

-- إعادة حساب subtotal و total لجميع الطلبات المتأثرة
DO $$
DECLARE
  order_rec RECORD;
  calculated_subtotal numeric;
  calculated_total numeric;
BEGIN
  FOR order_rec IN
    SELECT
      o.id,
      o.delivery_fee,
      COALESCE(o.points_discount, 0) as points_discount,
      COALESCE(o.coupon_discount, 0) as coupon_discount,
      o.subtotal as old_subtotal,
      o.total as old_total
    FROM orders o
    WHERE EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = o.id
    )
  LOOP
    -- حساب المجموع الفرعي من order_items
    SELECT COALESCE(SUM(total), 0)
    INTO calculated_subtotal
    FROM order_items
    WHERE order_id = order_rec.id;

    -- حساب المجموع الكلي
    calculated_total := calculated_subtotal
                       + COALESCE(order_rec.delivery_fee, 0)
                       - order_rec.points_discount
                       - order_rec.coupon_discount;

    -- التأكد من أن المجموع لا يكون سالباً
    IF calculated_total < 0 THEN
      calculated_total := 0;
    END IF;

    -- تحديث الطلب فقط إذا كان هناك فرق
    IF calculated_subtotal != COALESCE(order_rec.old_subtotal, 0)
       OR calculated_total != COALESCE(order_rec.old_total, 0) THEN
      UPDATE orders
      SET
        subtotal = calculated_subtotal,
        total = calculated_total,
        updated_at = now()
      WHERE id = order_rec.id;
    END IF;
  END LOOP;
END $$;
