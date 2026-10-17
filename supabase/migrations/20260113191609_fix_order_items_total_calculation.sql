/*
  # Fix order_items total calculation to include addons correctly

  1. Changes
    - Drop the existing generated column for `total`
    - Add new total column that calculates: (price × quantity) + sum of addons
    - Update all existing order_items with correct price (product base price only)
  
  2. Security
    - No changes to RLS policies
*/

-- Step 1: Drop the generated column
ALTER TABLE order_items ALTER COLUMN total DROP EXPRESSION IF EXISTS;

-- Step 2: Make it a regular numeric column
ALTER TABLE order_items ALTER COLUMN total SET DATA TYPE numeric USING total;

-- Step 3: Create a function to calculate total correctly
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
  -- Calculate sum of all addons (addon.price * addon.quantity)
  IF item_addons_data IS NOT NULL THEN
    FOR addon IN SELECT * FROM jsonb_array_elements(item_addons_data)
    LOOP
      addons_sum := addons_sum + (
        COALESCE((addon->>'price')::numeric, 0) * 
        COALESCE((addon->>'quantity')::numeric, 1)
      );
    END LOOP;
  END IF;
  
  -- Return: (base_price * quantity) + addons_sum
  RETURN (item_price * item_quantity) + addons_sum;
END;
$$;

-- Step 4: Update all existing order_items to have correct price
-- (This sets price to base product price, removing any added addon prices)
DO $$
DECLARE
  item_rec RECORD;
  base_price numeric;
  addons_sum numeric;
BEGIN
  FOR item_rec IN
    SELECT oi.id, oi.product_id, oi.price, oi.quantity, oi.addons_data
    FROM order_items oi
    WHERE oi.addons_data IS NOT NULL
    AND jsonb_array_length(oi.addons_data) > 0
  LOOP
    -- Get base product price
    SELECT p.price INTO base_price
    FROM products p
    WHERE p.id = item_rec.product_id;
    
    -- Skip if product not found
    IF base_price IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Update price to base product price only
    UPDATE order_items
    SET price = base_price
    WHERE id = item_rec.id;
  END LOOP;
END $$;

-- Step 5: Update all total values using the new calculation
UPDATE order_items
SET total = calculate_order_item_total(price, quantity, addons_data);

-- Step 6: Create a trigger to automatically calculate total on insert/update
CREATE OR REPLACE FUNCTION update_order_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := calculate_order_item_total(NEW.price, NEW.quantity, NEW.addons_data);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_item_total_trigger ON order_items;

CREATE TRIGGER order_item_total_trigger
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_item_total();
