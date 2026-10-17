/*
  # تفعيل RLS على جدول orders

  1. المشكلة
    - RLS معطل على جدول orders (rowsecurity = false)
    - جميع السياسات موجودة لكنها غير مفعلة
    - البائعون والسائقون يرون الطلبات بحالة pending

  2. الحل
    - تفعيل RLS على جدول orders
    - جميع السياسات الموجودة ستبدأ بالعمل تلقائياً
*/

-- تفعيل RLS على جدول orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
