/*
  # تعطيل المعالجة التلقائية للطلبات نهائياً
  
  1. التغييرات
    - تحديث دالة check_auto_processing لتعطيل المعالجة التلقائية بشكل كامل
    - إضافة فحص إضافي للتأكد من عدم تحويل الطلبات من pending تلقائياً
  
  2. الملاحظات
    - الطلبات الجديدة ستبقى بحالة pending حتى تتم الموافقة عليها يدوياً
    - المعالجة التلقائية معطلة بشكل صريح
*/

-- تحديث دالة المعالجة التلقائية لتعطيلها بشكل كامل
CREATE OR REPLACE FUNCTION check_auto_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_processing BOOLEAN := false;
BEGIN
  -- محاولة قراءة الإعداد من app_settings
  BEGIN
    SELECT COALESCE((settings->'orders'->>'autoProcessing')::boolean, false)
    INTO v_auto_processing
    FROM app_settings
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- في حالة حدوث خطأ، نتأكد من أن المعالجة التلقائية معطلة
    v_auto_processing := false;
    RAISE NOTICE 'تعذر قراءة إعدادات المعالجة التلقائية - الإعداد الافتراضي: معطل';
  END;

  -- لوج تفصيلي
  RAISE NOTICE '🔍 جدول: %, الحالة: %, المعالجة التلقائية: %', 
    TG_TABLE_NAME, NEW.status, v_auto_processing;

  -- التأكد من أن المعالجة التلقائية مفعلة بشكل صريح
  -- وأن الحالة هي pending فقط
  IF v_auto_processing = true AND NEW.status = 'pending' THEN
    RAISE NOTICE '✅ تحويل الطلب من pending إلى processing';
    NEW.status := 'processing';
    NEW.updated_at := now();
  ELSE
    -- في جميع الحالات الأخرى، نبقي الطلب كما هو
    RAISE NOTICE '⏸️ الطلب يبقى بحالة: % (المعالجة التلقائية: %)', NEW.status, v_auto_processing;
  END IF;

  RETURN NEW;
END;
$$;

-- التأكد من أن الإعداد في قاعدة البيانات معطل
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'false'::jsonb,
  true
)
WHERE (settings->'orders'->>'autoProcessing')::boolean IS DISTINCT FROM false;
