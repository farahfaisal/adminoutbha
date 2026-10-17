-- Add delivery_zones column to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'delivery_zones'
  ) THEN
    ALTER TABLE vendors ADD COLUMN delivery_zones JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index on delivery_zones column
CREATE INDEX IF NOT EXISTS idx_vendors_delivery_zones ON vendors USING gin (delivery_zones);

-- Add comment to explain the column purpose
COMMENT ON COLUMN vendors.delivery_zones IS 'JSON array of delivery zones with prices for zone-based delivery';

-- Create function to calculate delivery fee based on zone
CREATE OR REPLACE FUNCTION calculate_zone_delivery_fee(
  p_vendor_id UUID,
  p_zone_name TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_zones JSONB;
  v_zone_price NUMERIC;
  v_min_fee NUMERIC;
BEGIN
  -- Get vendor delivery zones
  SELECT 
    delivery_zones,
    min_delivery_fee
  INTO 
    v_zones,
    v_min_fee
  FROM vendors
  WHERE id = p_vendor_id;
  
  -- If no zones defined, return min delivery fee
  IF v_zones IS NULL OR jsonb_array_length(v_zones) = 0 THEN
    RETURN COALESCE(v_min_fee, 0);
  END IF;
  
  -- Find the zone price
  SELECT 
    (jsonb_array_elements(v_zones)->>'price')::NUMERIC INTO v_zone_price
  FROM jsonb_array_elements(v_zones)
  WHERE jsonb_array_elements(v_zones)->>'name' = p_zone_name
  LIMIT 1;
  
  -- If zone not found, return min delivery fee
  IF v_zone_price IS NULL THEN
    RETURN COALESCE(v_min_fee, 0);
  END IF;
  
  -- Return zone price
  RETURN v_zone_price;
END;
$$;

-- Create function to get all delivery zones for a vendor
CREATE OR REPLACE FUNCTION get_vendor_delivery_zones(
  p_vendor_id UUID
)
RETURNS TABLE (
  name TEXT,
  price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (zone->>'name')::TEXT,
    (zone->>'price')::NUMERIC
  FROM 
    vendors,
    jsonb_array_elements(vendors.delivery_zones) AS zone
  WHERE 
    vendors.id = p_vendor_id;
END;
$$;

-- Create function to update vendor delivery zones
CREATE OR REPLACE FUNCTION update_vendor_delivery_zones(
  p_vendor_id UUID,
  p_zones JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update vendor delivery zones
  UPDATE vendors
  SET 
    delivery_zones = p_zones,
    updated_at = NOW()
  WHERE id = p_vendor_id;
  
  RETURN FOUND;
END;
$$;

-- Update shipping_methods table to support zone-based delivery
ALTER TABLE shipping_methods 
ADD COLUMN IF NOT EXISTS settings JSONB;

-- Add comment to explain the column purpose
COMMENT ON COLUMN shipping_methods.settings IS 'JSON configuration for delivery settings. Example:
{
  "price_per_km": 5,
  "min_distance": 1,
  "max_distance": 10,
  "free_delivery_min": 100,
  "zones": [
    {
      "name": "Zone A",
      "cost": 10
    }
  ]
}';

-- Create function to validate delivery type
CREATE OR REPLACE FUNCTION validate_delivery_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure settings is not null
  IF NEW.settings IS NULL THEN
    NEW.settings := '{}'::jsonb;
  END IF;
  
  -- Validate settings based on delivery type
  CASE NEW.delivery_type
    WHEN 'distance' THEN
      -- Ensure distance settings exist
      IF NOT (NEW.settings ? 'price_per_km') THEN
        NEW.settings := jsonb_set(NEW.settings, '{price_per_km}', '0');
      END IF;
      IF NOT (NEW.settings ? 'min_distance') THEN
        NEW.settings := jsonb_set(NEW.settings, '{min_distance}', '0');
      END IF;
      IF NOT (NEW.settings ? 'max_distance') THEN
        NEW.settings := jsonb_set(NEW.settings, '{max_distance}', '10');
      END IF;
    
    WHEN 'fixed' THEN
      -- Ensure fixed price setting exists
      IF NOT (NEW.settings ? 'fixed_price') THEN
        NEW.settings := jsonb_set(NEW.settings, '{fixed_price}', to_jsonb(NEW.cost));
      END IF;
    
    WHEN 'zones' THEN
      -- Ensure zones array exists
      IF NOT (NEW.settings ? 'zones') OR jsonb_typeof(NEW.settings->'zones') != 'array' THEN
        NEW.settings := jsonb_set(NEW.settings, '{zones}', '[]'::jsonb);
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate delivery type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'validate_delivery_type_trigger'
    AND tgrelid = 'shipping_methods'::regclass
  ) THEN
    CREATE TRIGGER validate_delivery_type_trigger
    BEFORE INSERT OR UPDATE ON shipping_methods
    FOR EACH ROW
    EXECUTE FUNCTION validate_delivery_type();
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_zone_delivery_fee(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_delivery_zones(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_vendor_delivery_zones(UUID, JSONB) TO authenticated;