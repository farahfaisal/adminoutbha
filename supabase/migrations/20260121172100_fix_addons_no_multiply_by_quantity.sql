/*
  # تصحيح حساب الإضافات - بدون ضرب في الكمية

  1. المشكلة
    - الإضافات كانت تُضرب في كمية المنتج: (price + addons) × quantity
    - هذا خطأ لأن الإضافات لها كميتها الخاصة
  
  2. الحل الصحيح
    - حساب المنتج: price × quantity
    - حساب الإضافات: sum(addon.price × addon.quantity)
    - المجموع: (price × quantity) + sum_of_addons
  
  3. مثال
    - المنتج: 10 شيكل، الكمية: 5
    - الإضافات: بيض (5×2) + بيكن (7×2) = 10 + 14 = 24 شيكل
    - الحساب الصحيح: (10 × 5) + 24 = 50 + 24 = 74 شيكل
    - ❌ الحساب الخاطئ: (10 + 24) × 5 = 170 شيكل
  
  4. الأمان
    - لا تغييرات في سياسات RLS
*/

-- تحديث دالة حساب المنتجات - بدون ضرب الإضافات في الكمية
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
  addons_sum numeric := 0;
  addon jsonb;
BEGIN
  -- حساب مجموع أسعار الإضافات (كل إضافة لها كميتها الخاصة)
  IF item_addons_data IS NOT NULL THEN
    FOR addon IN SELECT * FROM jsonb_array_elements(item_addons_data)
    LOOP
      addons_sum := addons_sum + (
        COALESCE((addon->>'price')::numeric, 0) * 
        COALESCE((addon->>'quantity')::numeric, 1)
      );
    END LOOP;
  END IF;
  
  -- ضرب سعر المنتج في الكمية، ثم إضافة الإضافات (بدون ضرب)
  RETURN (item_price * item_quantity) + addons_sum;
END;
$$;

-- إعادة حساب جميع order_items بالطريقة الصحيحة
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
