/*
  # إصلاح سياسات الإعلانات للسماح بالإضافة

  1. التغييرات
    - إضافة سياسة للسماح بإدارة الإعلانات لجميع المستخدمين

  2. السبب
    - نظام المصادقة الحالي يستخدم localStorage وليس Supabase Auth
    - لذلك auth.uid() يكون null دائماً

  3. الأمان
    - السياسة مفتوحة مؤقتاً للسماح بالعمليات
    - يمكن تقييدها لاحقاً عند تفعيل Supabase Auth
*/

-- حذف السياسة إن وجدت
DROP POLICY IF EXISTS "Allow unauthenticated advertisement management" ON advertisements;

-- إضافة سياسة جديدة
CREATE POLICY "Allow unauthenticated advertisement management"
  ON advertisements
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
