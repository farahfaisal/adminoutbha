/*
  # إضافة حقول الموقع وتكلفة التوصيل للباعة

  1. التغييرات
    - إضافة حقول جديدة لجدول `vendors`:
      - `latitude` (decimal): خط العرض لموقع البائع
      - `longitude` (decimal): خط الطول لموقع البائع
      - `min_delivery_fee` (decimal): الحد الأدنى لتكلفة التوصيل
      - `delivery_fee_per_km` (decimal): تكلفة التوصيل لكل كيلومتر
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE vendors ADD COLUMN latitude decimal(10,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE vendors ADD COLUMN longitude decimal(11,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'min_delivery_fee'
  ) THEN
    ALTER TABLE vendors ADD COLUMN min_delivery_fee decimal(10,2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'delivery_fee_per_km'
  ) THEN
    ALTER TABLE vendors ADD COLUMN delivery_fee_per_km decimal(10,2) DEFAULT 0.00;
  END IF;
END $$;

-- إنشاء دالة لحساب تكلفة التوصيل بين موقعين
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
  p_vendor_id uuid,
  p_customer_lat decimal,
  p_customer_lng decimal
)
RETURNS decimal AS $$
DECLARE
  v_vendor_lat decimal;
  v_vendor_lng decimal;
  v_min_fee decimal;
  v_fee_per_km decimal;
  v_distance decimal;
  v_fee decimal;
BEGIN
  -- الحصول على بيانات البائع
  SELECT 
    latitude, 
    longitude, 
    min_delivery_fee, 
    delivery_fee_per_km
  INTO 
    v_vendor_lat, 
    v_vendor_lng, 
    v_min_fee, 
    v_fee_per_km
  FROM vendors
  WHERE id = p_vendor_id;
  
  -- التحقق من وجود بيانات الموقع
  IF v_vendor_lat IS NULL OR v_vendor_lng IS NULL THEN
    RETURN v_min_fee;
  END IF;
  
  -- حساب المسافة بين الموقعين (بالكيلومتر)
  -- باستخدام صيغة هافرسين (Haversine formula)
  v_distance := (
    6371 * acos(
      cos(radians(v_vendor_lat)) * 
      cos(radians(p_customer_lat)) * 
      cos(radians(p_customer_lng) - radians(v_vendor_lng)) + 
      sin(radians(v_vendor_lat)) * 
      sin(radians(p_customer_lat))
    )
  );
  
  -- حساب تكلفة التوصيل
  v_fee := v_min_fee + (v_distance * v_fee_per_km);
  
  -- التأكد من أن التكلفة لا تقل عن الحد الأدنى
  RETURN GREATEST(v_fee, v_min_fee);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;