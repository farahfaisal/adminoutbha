/*
  # إضافة صور للإضافات وإنشاء مخزن مخصص

  1. تعديلات على الجداول
    - إضافة حقل `image_url` لجدول `product_addons`
      - `image_url` (text, nullable): رابط صورة الإضافة

  2. Storage Buckets
    - إنشاء bucket جديد باسم `addons` لتخزين صور الإضافات
    - السماح للمستخدمين المصادقين برفع وحذف الصور
    - السماح للجميع بمشاهدة الصور

  3. الملاحظات
    - حقل image_url اختياري لعدم التأثير على البيانات الموجودة
    - bucket يدعم جميع أنواع الصور
*/

-- إضافة حقل image_url لجدول product_addons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_addons' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE product_addons ADD COLUMN image_url text;
  END IF;
END $$;

-- إنشاء bucket للإضافات
INSERT INTO storage.buckets (id, name, public)
VALUES ('addons', 'addons', true)
ON CONFLICT (id) DO NOTHING;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Authenticated users can upload addon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update addon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete addon images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view addon images" ON storage.objects;

-- السماح للمستخدمين المصادقين برفع الصور
CREATE POLICY "Authenticated users can upload addon images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'addons');

-- السماح للمستخدمين المصادقين بتحديث الصور
CREATE POLICY "Authenticated users can update addon images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'addons')
WITH CHECK (bucket_id = 'addons');

-- السماح للمستخدمين المصادقين بحذف الصور
CREATE POLICY "Authenticated users can delete addon images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'addons');

-- السماح للجميع بمشاهدة الصور
CREATE POLICY "Anyone can view addon images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'addons');