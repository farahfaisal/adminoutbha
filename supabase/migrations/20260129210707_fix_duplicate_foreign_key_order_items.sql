/*
  # إصلاح Foreign Key المكررة في order_items

  ## المشكلة
  - يوجد foreign key مكررة على عمود product_id في جدول order_items
  - fk_product و order_items_product_id_fkey يشيران لنفس العلاقة
  - هذا يسبب خطأ PGRST201 عند محاولة استخدام العلاقة

  ## الحل
  - حذف Foreign Key المكررة (fk_product)
  - الاحتفاظ بـ order_items_product_id_fkey فقط
*/

-- حذف Foreign Key المكررة
ALTER TABLE IF EXISTS order_items 
DROP CONSTRAINT IF EXISTS fk_product;
