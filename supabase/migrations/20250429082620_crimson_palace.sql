/*
  # إصلاح مشكلة لوحة تحكم البائع

  1. التغييرات
    - إضافة دالة لتحديث بيانات البائع
    - إضافة دالة للحصول على بيانات البائع
    - تحديث سياسات RLS للسماح بتحديث البائعين
*/

-- إنشاء دالة لتحديث بيانات البائع
CREATE OR REPLACE FUNCTION update_vendor(
  p_vendor_id uuid,
  p_store_name text,
  p_phone text,
  p_address text,
  p_description text,
  p_delivery_type text,
  p_delivery_radius numeric,
  p_price_per_km numeric,
  p_status text,
  p_logo_url text,
  p_banner_url text,
  p_wallet_enabled boolean,
  p_auto_charge boolean,
  p_service_areas text[],
  p_membership jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- تحديث بيانات البائع
  UPDATE vendors
  SET 
    store_name = p_store_name,
    phone = p_phone,
    address = p_address,
    description = p_description,
    delivery_type = p_delivery_type,
    delivery_radius = p_delivery_radius,
    price_per_km = p_price_per_km,
    status = p_status,
    logo_url = p_logo_url,
    banner_url = p_banner_url,
    wallet_enabled = p_wallet_enabled,
    auto_charge = p_auto_charge,
    service_areas = p_service_areas,
    membership = p_membership,
    updated_at = now()
  WHERE id = p_vendor_id
  RETURNING row_to_json(vendors.*)::jsonb INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة للحصول على بيانات البائع
CREATE OR REPLACE FUNCTION get_vendor_details(p_vendor_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_vendor jsonb;
  v_categories jsonb;
  v_products jsonb;
  v_result jsonb;
BEGIN
  -- الحصول على بيانات البائع
  SELECT row_to_json(v)::jsonb INTO v_vendor
  FROM (
    SELECT * FROM vendors WHERE id = p_vendor_id
  ) v;
  
  -- الحصول على فئات البائع
  SELECT json_agg(c.id)::jsonb INTO v_categories
  FROM vendor_categories vc
  JOIN categories c ON vc.category_id = c.id
  WHERE vc.vendor_id = p_vendor_id;
  
  -- الحصول على منتجات البائع
  SELECT json_agg(p)::jsonb INTO v_products
  FROM (
    SELECT * FROM products WHERE vendor_id = p_vendor_id
  ) p;
  
  -- دمج البيانات
  v_result := v_vendor;
  v_result := jsonb_set(v_result, '{categories}', COALESCE(v_categories, '[]'::jsonb));
  v_result := jsonb_set(v_result, '{products}', COALESCE(v_products, '[]'::jsonb));
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة للحصول على بيانات المنتج مع الإضافات
CREATE OR REPLACE FUNCTION get_product_with_addons(p_product_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_product jsonb;
BEGIN
  -- الحصول على بيانات المنتج
  SELECT row_to_json(p)::jsonb INTO v_product
  FROM (
    SELECT * FROM products WHERE id = p_product_id
  ) p;
  
  RETURN v_product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة للحصول على بيانات البائع بواسطة معرف المستخدم
CREATE OR REPLACE FUNCTION get_vendor_by_user_id(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_vendor_id uuid;
  v_result jsonb;
BEGIN
  -- الحصول على معرف البائع
  SELECT id INTO v_vendor_id
  FROM vendors
  WHERE user_id = p_user_id;
  
  -- إذا لم يتم العثور على بائع، أرجع null
  IF v_vendor_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- استخدام دالة get_vendor_details للحصول على بيانات البائع
  v_result := get_vendor_details(v_vendor_id);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;