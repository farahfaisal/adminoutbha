/*
  # إصلاح: تحديث order_items.price ليكون السعر الأساسي فقط

  1. المشكلة
    - order_items.price يحتوي على (السعر الأساسي + الإضافات)
    - يجب أن يحتوي على السعر الأساسي فقط من items_data

  2. الحل
    - استخراج السعر الأساسي من orders.items_data
    - تحديث order_items.price
    - إعادة حساب total
*/

-- تحديث order_items.price ليكون السعر الأساسي فقط من items_data
DO $$
DECLARE
  order_rec RECORD;
  item jsonb;
  item_id text;
  item_price numeric;
BEGIN
  -- المرور على جميع الطلبات
  FOR order_rec IN
    SELECT id, items_data
    FROM orders
    WHERE items_data IS NOT NULL
    AND jsonb_array_length(items_data) > 0
  LOOP
    -- المرور على كل عنصر في items_data
    FOR item IN SELECT * FROM jsonb_array_elements(order_rec.items_data)
    LOOP
      -- استخراج معرف المنتج
      item_id := COALESCE(item->>'id', item->>'product_id');
      item_price := COALESCE((item->>'price')::numeric, 0);
      
      IF item_id IS NOT NULL AND item_price > 0 THEN
        -- تحديث order_items بالسعر الأساسي فقط
        UPDATE order_items oi
        SET 
          price = item_price,
          total = calculate_order_item_total(item_price, oi.quantity, oi.addons_data)
        WHERE oi.order_id = order_rec.id
          AND (
            oi.product_id::text = (item->>'product_id')::text
            OR oi.product_id::text || '_' || COALESCE(oi.variant_id::text, '') = item_id
          );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- إعادة حساب subtotal و total لجميع الطلبات
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