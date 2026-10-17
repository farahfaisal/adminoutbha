/*
  # Fix order_items prices to use correct price from items_data

  1. Changes
    - Update order_items prices to match the original price from orders.items_data
    - This handles cases where variants have different prices than base products
  
  2. Security
    - No changes to RLS policies
*/

-- Update order_items to use the correct price from orders.items_data
DO $$
DECLARE
  order_rec RECORD;
  item_data jsonb;
  item_id text;
  item_price numeric;
BEGIN
  -- Loop through all orders that have items_data
  FOR order_rec IN
    SELECT id, items_data
    FROM orders
    WHERE items_data IS NOT NULL
    AND jsonb_array_length(items_data) > 0
  LOOP
    -- Loop through each item in items_data
    FOR item_data IN SELECT * FROM jsonb_array_elements(order_rec.items_data)
    LOOP
      -- Get the item ID (combination of product_id and variant_id)
      item_id := item_data->>'id';
      item_price := (item_data->>'price')::numeric;
      
      -- Update the corresponding order_item
      UPDATE order_items
      SET price = item_price
      WHERE order_id = order_rec.id
      AND (
        -- Match by product name if available
        product_name = item_data->>'name'
        OR 
        -- Or match by product_id
        product_id::text = item_data->>'product_id'
      )
      -- Only update if quantity matches (to ensure we update the right item)
      AND quantity = (item_data->>'quantity')::integer;
    END LOOP;
  END LOOP;
END $$;

-- Update all totals after fixing prices
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data);
