/*
  # إزالة السياسات الخطيرة وتأكيد إخفاء الطلبات pending عن البائعين
  
  1. التغييرات
    - حذف سياسة "Anyone can update orders" الخطيرة
    - التأكد من وجود سياسة إخفاء pending للبائعين
    - التأكد من وجود سياسة إخفاء pending للسائقين
  
  2. الأمان
    - البائعون: يرون طلباتهم فقط بعد قبولها (بعد pending)
    - السائقون: يرون الطلبات المعينة لهم فقط بعد pending
    - العملاء: يرون طلباتهم في جميع الحالات
*/

-- حذف السياسة الخطيرة التي تسمح لأي شخص بالتعديل
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;

-- التأكد من تفعيل RLS على جدول orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- التأكد من وجود سياسة البائعين (إخفاء pending)
DROP POLICY IF EXISTS "Vendors can view their orders (exclude pending)" ON orders;

CREATE POLICY "Vendors can view their orders (exclude pending)"
ON orders
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND status != 'pending'
);

-- التأكد من وجود سياسة السائقين (إخفاء pending)
DROP POLICY IF EXISTS "Drivers can view their assigned orders (exclude pending)" ON orders;

CREATE POLICY "Drivers can view their assigned orders (exclude pending)"
ON orders
FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND status != 'pending'
);

-- التأكد من أن البائعين يمكنهم تعديل طلباتهم فقط (بعد pending)
DROP POLICY IF EXISTS "Vendors can update their orders" ON orders;

CREATE POLICY "Vendors can update their orders (exclude pending)"
ON orders
FOR UPDATE
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND status != 'pending'
)
WITH CHECK (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND status != 'pending'
);