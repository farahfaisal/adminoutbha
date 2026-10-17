/*
  # إنشاء دالة لتطبيق عروض التوصيل

  1. الدالة الجديدة
    - `apply_delivery_offer` - تطبق أفضل عرض متاح على رسوم التوصيل

  2. الوظائف
    - تبحث عن العروض النشطة
    - تطبق العرض الأفضل للمستخدم
    - تدعم نوعين من الخصم: نسبة مئوية أو مبلغ ثابت
    - تحترم الحد الأدنى للطلب والحد الأقصى للخصم
*/

-- دالة لتطبيق عروض التوصيل
CREATE OR REPLACE FUNCTION apply_delivery_offer(
  p_vendor_id UUID,
  p_subtotal NUMERIC,
  p_delivery_fee NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
  v_discount NUMERIC := 0;
  v_final_delivery_fee NUMERIC;
  v_offer_applied BOOLEAN := FALSE;
  v_offer_id UUID := NULL;
  v_offer_title TEXT := NULL;
BEGIN
  -- البحث عن أفضل عرض متاح
  -- نبحث عن العروض النشطة التي تطابق المعايير
  SELECT 
    id,
    title,
    discount_type,
    discount_value,
    max_discount,
    usage_limit,
    used_count
  INTO v_offer
  FROM delivery_offers
  WHERE 
    status = 'active'
    AND CURRENT_DATE BETWEEN start_date AND end_date
    AND p_subtotal >= min_order_amount
    AND (vendor_id IS NULL OR vendor_id = p_vendor_id)
    AND (usage_limit IS NULL OR used_count < usage_limit)
  ORDER BY 
    -- ترتيب حسب قيمة الخصم (الأكبر أولاً)
    CASE 
      WHEN discount_type = 'percentage' THEN 
        LEAST(p_delivery_fee * (discount_value / 100), COALESCE(max_discount, p_delivery_fee))
      ELSE 
        LEAST(discount_value, p_delivery_fee)
    END DESC
  LIMIT 1;

  -- إذا لم يتم العثور على عرض، نعيد رسوم التوصيل الأصلية
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'delivery_fee', p_delivery_fee,
      'discount', 0,
      'final_delivery_fee', p_delivery_fee,
      'offer_applied', FALSE,
      'offer_id', NULL,
      'offer_title', NULL
    );
  END IF;

  -- حساب قيمة الخصم
  IF v_offer.discount_type = 'percentage' THEN
    v_discount := p_delivery_fee * (v_offer.discount_value / 100);
    
    -- تطبيق الحد الأقصى للخصم إن وجد
    IF v_offer.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_offer.max_discount);
    END IF;
  ELSE
    -- خصم ثابت
    v_discount := LEAST(v_offer.discount_value, p_delivery_fee);
  END IF;

  -- حساب رسوم التوصيل النهائية
  v_final_delivery_fee := GREATEST(p_delivery_fee - v_discount, 0);

  -- تحديث عداد الاستخدام
  UPDATE delivery_offers
  SET used_count = used_count + 1
  WHERE id = v_offer.id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'delivery_fee', p_delivery_fee,
    'discount', v_discount,
    'final_delivery_fee', v_final_delivery_fee,
    'offer_applied', TRUE,
    'offer_id', v_offer.id,
    'offer_title', v_offer.title
  );
END;
$$;

-- دالة محسّنة لحساب رسوم التوصيل مع العروض
CREATE OR REPLACE FUNCTION calculate_delivery_fee_with_offers(
  p_vendor_id UUID,
  p_customer_lat NUMERIC,
  p_customer_lng NUMERIC,
  p_subtotal NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_delivery_fee NUMERIC;
  v_result JSONB;
BEGIN
  -- حساب رسوم التوصيل الأساسية
  v_base_delivery_fee := calculate_delivery_fee(
    p_vendor_id,
    p_customer_lat,
    p_customer_lng
  );

  -- تطبيق عروض التوصيل
  v_result := apply_delivery_offer(
    p_vendor_id,
    p_subtotal,
    v_base_delivery_fee
  );

  RETURN v_result;
END;
$$;