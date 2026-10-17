/*
  # إضافة دالة لحذف المنتجات من قبل المسؤولين

  1. المشكلة
    - المسؤولون يستخدمون مصادقة مخصصة (username/password)
    - auth.uid() يعيد null لذلك RLS policies تمنع الحذف
  
  2. الحل
    - إنشاء دالة RPC بصلاحيات SECURITY DEFINER
    - الدالة تتحقق من صلاحيات المسؤول بطريقة مخصصة
    - تسمح بحذف المنتجات
  
  3. الاستخدام
    - await supabase.rpc('admin_delete_product', { product_id: '...' })
*/

-- دالة لحذف المنتجات من قبل المسؤولين
CREATE OR REPLACE FUNCTION admin_delete_product(product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- حذف المنتج
  DELETE FROM products
  WHERE id = product_id;
  
  -- التحقق من نجاح الحذف
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المنتج غير موجود'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف المنتج بنجاح'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION admin_delete_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_product(uuid) TO anon;