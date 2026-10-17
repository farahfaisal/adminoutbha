/*
  # إضافة سياسة للعملاء المسجلين لإنشاء الطلبات

  1. المشكلة
    - بعد تفعيل RLS، العملاء المسجلين (authenticated) لا يستطيعون إنشاء طلبات
    - السياسات الموجودة فقط للـ anon و public
    - خطأ: "new row violates row-level security policy for table orders"

  2. الحل
    - إضافة سياسة INSERT للمستخدمين المسجلين (authenticated)
    - السماح لأي مستخدم مسجل بإنشاء طلب
*/

-- إضافة سياسة INSERT للمستخدمين المسجلين
CREATE POLICY "Authenticated users can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
