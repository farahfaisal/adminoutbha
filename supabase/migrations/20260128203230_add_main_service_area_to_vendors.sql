/*
  # إضافة منطقة الخدمة الرئيسية للمتاجر

  1. التغييرات
    - إضافة حقل `main_service_area_id` في جدول vendors
    - ربط المتجر بمنطقة خدمة رئيسية واحدة لتسهيل البحث
  
  2. الاستخدام
    - يُستخدم للبحث في تطبيق الزبون
    - تحديد المنطقة الرئيسية التي يخدمها المتجر
  
  3. الأمان
    - لا تغييرات في RLS
    - الحقل اختياري (nullable)
*/

-- إضافة حقل منطقة الخدمة الرئيسية
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'main_service_area_id'
  ) THEN
    ALTER TABLE vendors
    ADD COLUMN main_service_area_id uuid REFERENCES service_areas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- إضافة تعليق على الحقل
COMMENT ON COLUMN vendors.main_service_area_id IS 'منطقة الخدمة الرئيسية للمتجر - تُستخدم للبحث في تطبيق الزبون';

-- إضافة فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_vendors_main_service_area 
ON vendors(main_service_area_id) 
WHERE main_service_area_id IS NOT NULL;
