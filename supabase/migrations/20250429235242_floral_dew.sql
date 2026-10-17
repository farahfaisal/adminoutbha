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
    WHERE table_name = 'vendors' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE vendors ADD COLUMN latitude decimal(10,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE vendors ADD COLUMN longitude decimal(11,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'min_delivery_fee'
  ) THEN
    ALTER TABLE vendors ADD COLUMN min_delivery_fee decimal(10,2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'delivery_fee_per_km'
  ) THEN
    ALTER TABLE vendors ADD COLUMN delivery_fee_per_km decimal(10,2) DEFAULT 0.00;
  END IF;
END $$;