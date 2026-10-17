/*
  # إضافة عمود وقت التوصيل المقدر للبائعين
  
  1. التعديلات
    - إضافة عمود estimated_delivery_time إلى جدول vendors
    - يحتوي على وقت التوصيل المقدر بالدقائق (مثلاً: 30 دقيقة، 45 دقيقة)
    - القيمة الافتراضية: 30 دقيقة
*/

-- إضافة عمود وقت التوصيل المقدر
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'estimated_delivery_time'
  ) THEN
    ALTER TABLE vendors ADD COLUMN estimated_delivery_time integer DEFAULT 30;
  END IF;
END $$;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN vendors.estimated_delivery_time IS 'وقت التوصيل المقدر بالدقائق';