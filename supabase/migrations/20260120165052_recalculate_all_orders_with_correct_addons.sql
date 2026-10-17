/*
  # إعادة حساب جميع الطلبات بالطريقة الصحيحة

  1. الهدف
    - إعادة حساب جميع order_items باستخدام الطريقة الصحيحة
    - الطريقة الصحيحة: (السعر الأساسي × الكمية) + (سعر كل إضافة × كميتها)
    - الإضافات لا تُضرب بكمية المنتج
  
  2. التغييرات
    - إعادة حساب total لجميع order_items
    - إعادة حساب subtotal و total لجميع orders
  
  3. ملاحظات
    - هذا سيصحح جميع الطلبات القديمة
    - الحساب يعتمد على البيانات الموجودة في addons_data
*/

-- إعادة حساب total لجميع order_items باستخدام الدالة الصحيحة
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data)
WHERE addons_data IS NOT NULL;

-- إعادة حساب total لجميع order_items التي ليس لها إضافات
UPDATE order_items
SET total = price * quantity
WHERE addons_data IS NULL OR jsonb_array_length(addons_data) = 0;

-- إعادة حساب subtotal و total لجميع الطلبات
DO $$
DECLARE
  order_rec RECORD;
  calculated_subtotal numeric;
  calculated_total numeric;
BEGIN
  FOR order_rec IN
    SELECT id, delivery_fee
    FROM orders
  LOOP
    -- حساب المجموع الفرعي من order_items
    SELECT COALESCE(SUM(total), 0)
    INTO calculated_subtotal
    FROM order_items
    WHERE order_id = order_rec.id;
    
    -- حساب المجموع الكلي
    calculated_total := calculated_subtotal + COALESCE(order_rec.delivery_fee, 0);
    
    -- تحديث الطلب
    UPDATE orders
    SET 
      subtotal = calculated_subtotal,
      total = calculated_total,
      updated_at = NOW()
    WHERE id = order_rec.id;
  END LOOP;
END $$;