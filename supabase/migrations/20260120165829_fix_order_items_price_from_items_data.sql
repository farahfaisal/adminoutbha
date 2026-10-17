/*
  # إصلاح أسعار order_items من items_data

  1. المشكلة
    - بعض order_items تحتوي على أسعار خاطئة (تتضمن سعر الإضافات)
    - السعر الصحيح موجود في orders.items_data

  2. الحل
    - نستخرج السعر الصحيح من items_data في جدول orders
    - نحدث price في order_items
    - نعيد حساب total
  
  3. ملاحظات
    - هذا يصلح جميع الطلبات القديمة التي لديها بيانات خاطئة
*/

-- إنشاء دالة لإصلاح أسعار order_items من items_data
CREATE OR REPLACE FUNCTION fix_order_items_prices_from_items_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  order_rec RECORD;
  item jsonb;
  item_id text;
  item_price numeric;
BEGIN
  -- المرور على جميع الطلبات التي لديها items_data
  FOR order_rec IN
    SELECT id, items_data
    FROM orders
    WHERE items_data IS NOT NULL
    AND jsonb_array_length(items_data) > 0
  LOOP
    -- المرور على كل عنصر في items_data
    FOR item IN SELECT * FROM jsonb_array_elements(order_rec.items_data)
    LOOP
      -- استخراج معرف المنتج (يمكن أن يكون product_id أو product_id + variant_id)
      item_id := COALESCE(item->>'id', item->>'product_id');
      item_price := COALESCE((item->>'price')::numeric, 0);
      
      IF item_id IS NOT NULL AND item_price > 0 THEN
        -- تحديث order_items التي تطابق هذا الطلب والمنتج
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
END;
$$;

-- تنفيذ الدالة لإصلاح جميع الأسعار
SELECT fix_order_items_prices_from_items_data();

-- حذف الدالة بعد الاستخدام
DROP FUNCTION IF EXISTS fix_order_items_prices_from_items_data();