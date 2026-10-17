/*
  # Fix order completion on delivery

  1. Changes
     - Adds a function to update order status when delivery is completed
     - Adds a trigger to driver_trips table that calls this function
     - Includes checks to prevent duplicate trigger creation
*/

-- Function to update order status to completed when delivery is completed
CREATE OR REPLACE FUNCTION public.complete_order_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the new status is 'completed'
  IF NEW.status = 'completed' THEN
    -- Update the order status to 'completed'
    UPDATE public.orders
    SET status = 'completed', updated_at = NOW()
    WHERE id = NEW.order_id;
    
    -- Add a record to order_status_history
    INSERT INTO public.order_status_history (
      order_id,
      status,
      note,
      created_by
    )
    VALUES (
      NEW.order_id,
      'completed',
      'تم اكتمال التوصيل بواسطة السائق',
      (SELECT user_id FROM drivers WHERE id = NEW.driver_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to driver_trips table (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'complete_order_on_delivery_trigger'
    AND tgrelid = 'public.driver_trips'::regclass
  ) THEN
    CREATE TRIGGER complete_order_on_delivery_trigger
    AFTER UPDATE OF status ON public.driver_trips
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.complete_order_on_delivery();
  END IF;
END
$$;

COMMENT ON FUNCTION public.complete_order_on_delivery() IS 'When a driver marks a delivery as completed, this function updates the order status to completed';