/*
  # إصلاح حساب الطلبات: ضرب الإضافات في كمية المنتج

  1. المشكلة
    - الإضافات تُحسب مرة واحدة بدلاً من ضربها في كمية المنتج
    - مثال: 3 برجر × (سعر البرجر + إضافات) = المجموع الخاطئ
    - الصحيح: (سعر البرجر + إضافات) × 3 = المجموع الصحيح
  
  2. الحل
    - تعديل دالة calculate_order_item_total لحساب:
      (price + sum_of_addons) × quantity
    - إعادة حساب جميع الطلبات القديمة
  
  3. مثال
    - المنتج: 32 شيكل
    - الإضافات: مشروم (10×2) + بيض (5×2) = 30 شيكل
    - الكمية: 3
    - الحساب الصحيح: (32 + 30) × 3 = 186 شيكل
*/

-- تحديث دالة حساب المنتجات
CREATE OR REPLACE FUNCTION calculate_order_item_total(
  item_price numeric,
  item_quantity integer,
  item_addons_data jsonb
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  addons_per_unit numeric := 0;
  addon jsonb;
BEGIN
  -- حساب مجموع أسعار الإضافات لكل وحدة
  IF item_addons_data IS NOT NULL THEN
    FOR addon IN SELECT * FROM jsonb_array_elements(item_addons_data)
    LOOP
      addons_per_unit := addons_per_unit + (
        COALESCE((addon->>'price')::numeric, 0) * 
        COALESCE((addon->>'quantity')::numeric, 1)
      );
    END LOOP;
  END IF;
  
  -- سعر الوحدة الواحدة × الكمية
  RETURN (item_price + addons_per_unit) * item_quantity;
END;
$$;

-- إعادة حساب جميع order_items
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data);

-- إعادة حساب جميع الطلبات
DO $$
DECLARE
  order_rec RECORD;
  calculated_subtotal numeric;
  calculated_total numeric;
BEGIN
  FOR order_rec IN
    SELECT id, delivery_fee, points_discount, coupon_discount
    FROM orders
  LOOP
    -- حساب المجموع الفرعي من order_items
    SELECT COALESCE(SUM(total), 0)
    INTO calculated_subtotal
    FROM order_items
    WHERE order_id = order_rec.id;
    
    -- حساب المجموع الكلي
    calculated_total := calculated_subtotal 
                       + COALESCE(order_rec.delivery_fee, 0)
                       - COALESCE(order_rec.points_discount, 0)
                       - COALESCE(order_rec.coupon_discount, 0);
    
    -- التأكد من أن المجموع لا يكون سالباً
    IF calculated_total < 0 THEN
      calculated_total := 0;
    END IF;
    
    -- تحديث الطلب
    UPDATE orders
    SET 
      subtotal = calculated_subtotal,
      total = calculated_total
    WHERE id = order_rec.id;
  END LOOP;
END $$;