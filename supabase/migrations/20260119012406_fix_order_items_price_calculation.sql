/*
  # Fix order_items price to contain base product price only

  1. Changes
    - Update order_items.price to use the base product price from orders.items_data
    - The price column should NOT include addons
    - Addons are calculated separately in the total column via calculate_order_item_total function
  
  2. Notes
    - This fixes the double-counting of addons issue
    - The total column will be automatically recalculated by the trigger
*/

-- Update order_items prices from orders.items_data
DO $$
DECLARE
  order_rec RECORD;
  item_data jsonb;
  base_price numeric;
  item_quantity integer;
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
      base_price := (item_data->>'price')::numeric;
      item_quantity := (item_data->>'quantity')::integer;
      
      -- Update the corresponding order_item to use base price only
      UPDATE order_items
      SET price = base_price
      WHERE order_id = order_rec.id
      AND quantity = item_quantity
      AND (
        product_name = item_data->>'name'
        OR name = item_data->>'name'
      );
    END LOOP;
  END LOOP;
END $$;

-- Recalculate all totals with the corrected prices
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data);
