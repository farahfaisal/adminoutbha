/*
  # إعادة حساب المبلغ الإجمالي لجميع order_items والطلبات

  1. المشكلة
    - بعض الطلبات لها total = 0 أو غير صحيح في order_items
    - المبلغ الإجمالي في orders غير دقيق
  
  2. الحل
    - إعادة حساب total لجميع order_items
    - إعادة حساب subtotal و total لجميع orders
  
  3. الصيغة
    - order_item.total = (price × quantity) + sum(addon.price × addon.quantity)
    - order.subtotal = sum(order_items.total)
    - order.total = subtotal + delivery_fee - points_discount - coupon_discount
  
  4. الأمان
    - لا تغييرات في RLS
    - فقط تحديث الحسابات
*/

-- إعادة حساب جميع order_items
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE total = 0 OR total IS NULL OR total != calculate_order_item_total(price, quantity, addons_data);

-- إعادة حساب جميع الطلبات (orders)
DO $$
DECLARE
  order_rec RECORD;
  calculated_subtotal numeric;
  calculated_total numeric;
BEGIN
  FOR order_rec IN
    SELECT 
      id, 
      delivery_fee, 
      COALESCE(points_discount, 0) as points_discount,
      COALESCE(coupon_discount, 0) as coupon_discount
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
                       - order_rec.points_discount
                       - order_rec.coupon_discount;
    
    -- التأكد من أن المجموع لا يكون سالباً
    IF calculated_total < 0 THEN
      calculated_total := 0;
    END IF;
    
    -- تحديث الطلب فقط إذا كان هناك فرق
    IF calculated_subtotal != (SELECT COALESCE(subtotal, 0) FROM orders WHERE id = order_rec.id)
       OR calculated_total != (SELECT COALESCE(total, 0) FROM orders WHERE id = order_rec.id) THEN
      UPDATE orders
      SET 
        subtotal = calculated_subtotal,
        total = calculated_total,
        updated_at = now()
      WHERE id = order_rec.id;
    END IF;
  END LOOP;
END $$;
