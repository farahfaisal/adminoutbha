/*
  # إزالة السياسة المكررة لعرض الطلبات للبائعين
  
  1. التغيير
    - حذف السياسة "Vendors can view their approved orders" المكررة
    - الإبقاء على "Vendors can view their orders (exclude pending)" فقط
  
  2. السبب
    - السياسة الأولى تحقق من admin_approved وهي غير مستخدمة حالياً
    - السياسة الثانية كافية لإخفاء الطلبات pending عن البائعين
*/

-- حذف السياسة المكررة
DROP POLICY IF EXISTS "Vendors can view their approved orders" ON orders;