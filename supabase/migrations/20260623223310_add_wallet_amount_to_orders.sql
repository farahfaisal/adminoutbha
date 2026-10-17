ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_amount numeric DEFAULT 0;
ALTER TABLE parcel_orders ADD COLUMN IF NOT EXISTS wallet_amount numeric DEFAULT 0;
COMMENT ON COLUMN orders.wallet_amount IS 'Amount paid from customer wallet balance';
