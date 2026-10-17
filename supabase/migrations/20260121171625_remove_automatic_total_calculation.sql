/*
  # إزالة الحساب التلقائي للمبلغ الإجمالي

  1. التغييرات
    - حذف trigger الذي يحسب المبلغ الإجمالي تلقائياً عند إضافة/تعديل order_items
    - الاحتفاظ بـ function حساب المبلغ (calculate_order_item_total) للاستخدام اليدوي
    - السماح بتحديد قيمة total يدوياً عند إنشاء الطلبات
  
  2. الأسباب
    - السماح بتحديد الأسعار يدوياً من خلال API
    - عدم إعادة حساب المبلغ تلقائياً عند كل تعديل
    - مرونة أكبر في إدارة الأسعار
  
  3. الأمان
    - لا تغييرات في سياسات RLS
*/

-- حذف trigger الحساب التلقائي
DROP TRIGGER IF EXISTS order_item_total_trigger ON order_items;

-- حذف function التي تُستدعى من trigger
DROP FUNCTION IF EXISTS update_order_item_total();

-- الاحتفاظ بـ function الحساب للاستخدام اليدوي إذا احتاج المستخدم
-- calculate_order_item_total() ستبقى متاحة للاستدعاء اليدوي

-- تعيين قيمة افتراضية لـ total = 0 إذا لم يتم تحديدها
ALTER TABLE order_items 
ALTER COLUMN total SET DEFAULT 0;
