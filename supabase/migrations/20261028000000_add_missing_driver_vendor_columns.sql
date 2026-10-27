-- Applied to project dzavnjqstbbkcdfukgfp on 2026-10-28.
-- Columns the driver app and admin panel already read/write but were missing.
-- Without heading/is_tracking every GPS update from the driver app failed.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS heading numeric,
  ADD COLUMN IF NOT EXISTS is_tracking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS profile_image text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false;
UPDATE public.drivers SET vehicle_number = vehicle_plate WHERE vehicle_number IS NULL AND vehicle_plate IS NOT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS vacation_mode boolean NOT NULL DEFAULT false;
-- Admin orders list joins customers!orders_customer_id_fkey
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='fk_order_customer')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_customer_id_fkey') THEN
    ALTER TABLE public.orders RENAME CONSTRAINT fk_order_customer TO orders_customer_id_fkey;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
