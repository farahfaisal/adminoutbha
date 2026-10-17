/*
  # إزالة السياسات العامة للإعلانات

  1. التغييرات
    - حذف السياسات التي تسمح لأي شخص بإدارة الإعلانات
    - الإبقاء على سياسات المسؤولين والبائعين فقط

  2. الأمان
    - فقط المسؤولون والبائعون يمكنهم إدارة الإعلانات
    - الجميع يمكنهم مشاهدة الإعلانات النشطة
*/

-- حذف السياسات الخطيرة
DROP POLICY IF EXISTS "Allow unauthenticated advertisement management" ON advertisements;
DROP POLICY IF EXISTS "Anyone can delete advertisements" ON advertisements;
