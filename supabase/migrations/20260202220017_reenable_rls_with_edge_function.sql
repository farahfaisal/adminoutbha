/*
  # إعادة تفعيل RLS مع استخدام Edge Function

  1. الحل الآمن
    - إعادة تفعيل RLS على جدول orders
    - حذف سياسات INSERT للمستخدمين العاديين
    - المستخدمون سيستخدمون Edge Function (create-order) التي تستخدم service_role_key
    - service_role_key يتجاوز RLS تلقائياً

  2. السياسات
    - فقط service_role يمكنه INSERT
    - السياسات الأخرى (SELECT, UPDATE) تبقى كما هي
*/

-- إعادة تفعيل RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- حذف سياسات INSERT القديمة للمستخدمين العاديين
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_insert_orders" ON orders;

-- الإبقاء فقط على سياسة service_role (Edge Function)
-- لا حاجة لإنشائها - service_role يتجاوز RLS تلقائياً
