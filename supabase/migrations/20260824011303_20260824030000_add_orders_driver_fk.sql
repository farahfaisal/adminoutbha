/*
# Add missing FK on orders.driver_id → drivers.id

1. Purpose
- The Overview query references `drivers!orders_driver_id_fkey` but no such FK exists.
- Add it so Supabase schema cache can resolve the join.

2. Security
- No policy changes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_driver_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
  END IF;
END $$;
