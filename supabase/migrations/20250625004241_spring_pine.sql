/*
  # إصلاح نظام النقاط للعملاء
  
  1. التغييرات
    - إضافة دالة لإضافة النقاط تلقائيًا عند إكمال الطلبات
    - إضافة محفز (trigger) يعمل عند تغيير حالة الطلب إلى "مكتمل"
    - تحسين العلاقة بين الطلبات وحسابات النقاط
*/

-- إنشاء دالة لإضافة النقاط عند إكمال الطلب
CREATE OR REPLACE FUNCTION add_points_for_completed_order()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_order_total NUMERIC;
  v_points_to_add INTEGER;
  v_points_account_id UUID;
BEGIN
  -- التحقق من أن الطلب تم تغييره إلى حالة "مكتمل"
  IF NEW.status = 'completed' AND (OLD.status != 'completed' OR OLD.status IS NULL) THEN
    -- الحصول على معرف العميل ومجموع الطلب
    SELECT customer_id, total INTO v_customer_id, v_order_total
    FROM orders
    WHERE id = NEW.order_id;
    
    -- إذا لم يتم العثور على العميل أو كان المجموع صفرًا، نتوقف
    IF v_customer_id IS NULL OR v_order_total <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- حساب النقاط المراد إضافتها (نقطة واحدة لكل 10 شيكل)
    v_points_to_add := FLOOR(v_order_total / 10)::INTEGER;
    
    -- إذا كانت النقاط أقل من 1، نضيف نقطة واحدة على الأقل
    IF v_points_to_add < 1 THEN
      v_points_to_add := 1;
    END IF;
    
    -- البحث عن حساب نقاط العميل أو إنشاء حساب جديد
    SELECT id INTO v_points_account_id
    FROM points_accounts
    WHERE customer_id = v_customer_id;
    
    IF v_points_account_id IS NULL THEN
      -- إنشاء حساب نقاط جديد للعميل
      INSERT INTO points_accounts (
        customer_id,
        balance,
        total_earned,
        last_activity
      ) VALUES (
        v_customer_id,
        v_points_to_add,
        v_points_to_add,
        NOW()
      ) RETURNING id INTO v_points_account_id;
    ELSE
      -- تحديث حساب النقاط الموجود
      UPDATE points_accounts
      SET 
        balance = balance + v_points_to_add,
        total_earned = total_earned + v_points_to_add,
        last_activity = NOW()
      WHERE id = v_points_account_id;
    END IF;
    
    -- إضافة سجل معاملة النقاط
    INSERT INTO points_transactions (
      account_id,
      amount,
      type,
      description,
      order_id
    ) VALUES (
      v_points_account_id,
      v_points_to_add,
      'earn',
      'نقاط مكتسبة من الطلب #' || SUBSTRING(NEW.order_id::TEXT, 1, 8),
      NEW.order_id
    );
    
    -- تحديث الطلب بعدد النقاط المضافة
    UPDATE orders
    SET points_applied = v_points_to_add
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء محفز لإضافة النقاط عند إكمال الطلب
DO $$
BEGIN
  -- حذف المحفز إذا كان موجودًا
  DROP TRIGGER IF EXISTS add_points_on_order_completion ON order_status_history;
  
  -- إنشاء المحفز
  CREATE TRIGGER add_points_on_order_completion
  AFTER INSERT OR UPDATE OF status ON order_status_history
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION add_points_for_completed_order();
END
$$;

-- إنشاء دالة لإضافة النقاط يدويًا
CREATE OR REPLACE FUNCTION add_points_to_customer(
  p_customer_id UUID,
  p_points INTEGER,
  p_description TEXT DEFAULT 'إضافة نقاط يدوية'
)
RETURNS JSONB AS $$
DECLARE
  v_points_account_id UUID;
BEGIN
  -- التحقق من وجود العميل
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'العميل غير موجود'
    );
  END IF;
  
  -- البحث عن حساب نقاط العميل أو إنشاء حساب جديد
  SELECT id INTO v_points_account_id
  FROM points_accounts
  WHERE customer_id = p_customer_id;
  
  IF v_points_account_id IS NULL THEN
    -- إنشاء حساب نقاط جديد للعميل
    INSERT INTO points_accounts (
      customer_id,
      balance,
      total_earned,
      last_activity
    ) VALUES (
      p_customer_id,
      p_points,
      p_points,
      NOW()
    ) RETURNING id INTO v_points_account_id;
  ELSE
    -- تحديث حساب النقاط الموجود
    UPDATE points_accounts
    SET 
      balance = balance + p_points,
      total_earned = total_earned + p_points,
      last_activity = NOW()
    WHERE id = v_points_account_id;
  END IF;
  
  -- إضافة سجل معاملة النقاط
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description
  ) VALUES (
    v_points_account_id,
    p_points,
    'earn',
    p_description
  );
  
  -- إرجاع نجاح العملية
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'تمت إضافة النقاط بنجاح',
    'points_added', p_points,
    'account_id', v_points_account_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION add_points_for_completed_order() TO authenticated;
GRANT EXECUTE ON FUNCTION add_points_to_customer(UUID, INTEGER, TEXT) TO authenticated;