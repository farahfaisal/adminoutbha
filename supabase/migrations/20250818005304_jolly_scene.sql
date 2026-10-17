/*
  # دوال معالجة النقاط في الطلبات

  1. الدوال الجديدة
    - `apply_points_to_order` - تطبيق النقاط على الطلب
    - `calculate_points_discount` - حساب قيمة خصم النقاط
    - `validate_points_usage` - التحقق من صحة استخدام النقاط

  2. الأمان
    - التحقق من رصيد النقاط الكافي
    - التحقق من صحة بيانات الطلب
    - منع الاستخدام المضاعف للنقاط
*/

-- دالة حساب قيمة خصم النقاط (1 نقطة = 0.1 شيكل)
CREATE OR REPLACE FUNCTION calculate_points_discount(points_count integer)
RETURNS numeric(10,2)
LANGUAGE plpgsql
AS $$
BEGIN
  -- كل نقطة تساوي 0.1 شيكل
  RETURN points_count * 0.1;
END;
$$;

-- دالة التحقق من صحة استخدام النقاط
CREATE OR REPLACE FUNCTION validate_points_usage(
  p_customer_id uuid,
  p_points_to_use integer,
  p_order_total numeric(10,2)
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  customer_points_balance integer;
  max_discount_allowed numeric(10,2);
  points_discount_value numeric(10,2);
BEGIN
  -- الحصول على رصيد نقاط العميل
  SELECT COALESCE(balance, 0) INTO customer_points_balance
  FROM points_accounts
  WHERE customer_id = p_customer_id;

  -- التحقق من وجود رصيد كافٍ
  IF customer_points_balance < p_points_to_use THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'رصيد النقاط غير كافٍ'
    );
  END IF;

  -- حساب قيمة الخصم
  points_discount_value := calculate_points_discount(p_points_to_use);

  -- التحقق من أن الخصم لا يتجاوز 50% من قيمة الطلب
  max_discount_allowed := p_order_total * 0.5;
  
  IF points_discount_value > max_discount_allowed THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'لا يمكن أن يتجاوز خصم النقاط 50% من قيمة الطلب'
    );
  END IF;

  -- التحقق من الحد الأدنى للطلب بعد الخصم (10 شيكل)
  IF (p_order_total - points_discount_value) < 10 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'يجب أن تكون قيمة الطلب بعد الخصم 10 شيكل على الأقل'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_value', points_discount_value,
    'new_total', p_order_total - points_discount_value
  );
END;
$$;

-- دالة تطبيق النقاط على الطلب
CREATE OR REPLACE FUNCTION apply_points_to_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_points_to_use integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  order_record record;
  validation_result jsonb;
  points_discount_value numeric(10,2);
  new_order_total numeric(10,2);
  redemption_code text;
  points_account_id uuid;
BEGIN
  -- الحصول على بيانات الطلب
  SELECT * INTO order_record
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'الطلب غير موجود'
    );
  END IF;

  -- التحقق من أن الطلب لم يتم تطبيق نقاط عليه مسبقاً
  IF order_record.points_applied > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'تم تطبيق نقاط على هذا الطلب مسبقاً'
    );
  END IF;

  -- التحقق من صحة استخدام النقاط
  validation_result := validate_points_usage(p_customer_id, p_points_to_use, order_record.total);
  
  IF NOT (validation_result->>'valid')::boolean THEN
    RETURN validation_result;
  END IF;

  -- حساب القيم الجديدة
  points_discount_value := (validation_result->>'discount_value')::numeric;
  new_order_total := (validation_result->>'new_total')::numeric;

  -- إنشاء كود استبدال فريد
  redemption_code := 'PTS_' || upper(substring(md5(random()::text) from 1 for 8));

  -- الحصول على معرف حساب النقاط
  SELECT id INTO points_account_id
  FROM points_accounts
  WHERE customer_id = p_customer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حساب النقاط غير موجود'
    );
  END IF;

  -- تحديث الطلب
  UPDATE orders
  SET 
    points_applied = p_points_to_use,
    points_discount = points_discount_value,
    total = new_order_total,
    redemption_code = redemption_code,
    updated_at = now()
  WHERE id = p_order_id;

  -- خصم النقاط من حساب العميل
  UPDATE points_accounts
  SET 
    balance = balance - p_points_to_use,
    total_spent = total_spent + p_points_to_use,
    last_activity = now()
  WHERE id = points_account_id;

  -- إضافة معاملة نقاط
  INSERT INTO points_transactions (
    account_id,
    order_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    points_account_id,
    p_order_id,
    p_points_to_use,
    'spend',
    'استخدام نقاط في الطلب #' || order_record.order_number,
    redemption_code
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تطبيق النقاط بنجاح',
    'points_used', p_points_to_use,
    'discount_amount', points_discount_value,
    'new_total', new_order_total,
    'redemption_code', redemption_code
  );
END;
$$;