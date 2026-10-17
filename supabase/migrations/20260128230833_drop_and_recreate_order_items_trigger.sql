/*
  # حذف وإعادة إنشاء trigger حساب total في order_items

  1. الهدف
    - حذف الدوال والـ triggers القديمة
    - إعادة إنشائها بالصيغة الصحيحة
    - إصلاح جميع البيانات الموجودة
*/

-- حذف trigger القديم
DROP TRIGGER IF EXISTS auto_calculate_order_item_total_trigger ON order_items;

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS auto_calculate_order_item_total();
DROP FUNCTION IF EXISTS calculate_order_item_total(numeric, integer, jsonb);

-- إنشاء دالة جديدة لحساب total
CREATE FUNCTION calculate_order_item_total(
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
  base_total := p_price * p_quantity;

  IF p_addons_data IS NOT NULL AND jsonb_array_length(p_addons_data) > 0 THEN
    FOR addon IN SELECT * FROM jsonb_array_elements(p_addons_data)
    LOOP
      addons_total := addons_total + (
        COALESCE((addon->>'price')::numeric, 0) *
        COALESCE((addon->>'quantity')::integer, 1)
      );
    END LOOP;
  END IF;

  RETURN base_total + addons_total;
END;
$$;

-- إنشاء دالة trigger
CREATE FUNCTION auto_calculate_order_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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

-- إنشاء trigger
CREATE TRIGGER auto_calculate_order_item_total_trigger
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_order_item_total();

-- إصلاح البيانات الموجودة
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE total = 0 OR total IS NULL;