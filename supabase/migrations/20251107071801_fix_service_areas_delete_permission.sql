/*
  # إصلاح صلاحيات حذف مناطق الخدمة
  
  السماح لجميع المستخدمين (anon) بحذف مناطق الخدمة
  لأن التطبيق يستخدم مصادقة مخصصة وليس مصادقة Supabase
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Authenticated users can delete service areas" ON service_areas;

-- إنشاء سياسة جديدة تسمح للجميع بالحذف
CREATE POLICY "Anyone can delete service areas"
  ON service_areas FOR DELETE
  TO public
  USING (true);

-- تحديث سياسات الإدخال والتحديث أيضاً للتأكد
DROP POLICY IF EXISTS "Authenticated users can insert service areas" ON service_areas;
DROP POLICY IF EXISTS "Authenticated users can update service areas" ON service_areas;

CREATE POLICY "Anyone can insert service areas"
  ON service_areas FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update service areas"
  ON service_areas FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);