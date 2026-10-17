/*
  # إضافة trigger للإضافة اليدوية إلى قائمة الانتظار

  1. الوظيفة
    - عند تغيير حالة الطلب يدوياً إلى 'waiting-for-driver'
    - يتم إضافة الطلب إلى driver_waiting_list تلقائياً
    
  2. الفرق بين التلقائي واليدوي
    - التلقائي: فقط عند INSERT + المعالجة التلقائية مفعلة
    - اليدوي: دائماً عند UPDATE الحالة إلى 'waiting-for-driver'
*/

-- دالة الإضافة اليدوية
CREATE OR REPLACE FUNCTION add_to_waiting_list_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تغيرت الحالة إلى 'waiting-for-driver'
  IF NEW.status = 'waiting-for-driver' AND OLD.status != 'waiting-for-driver' THEN
    -- إضافة إلى driver_waiting_list (للطلبات العادية فقط)
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      status,
      created_at,
      geocoded_latitude,
      geocoded_longitude
    ) VALUES (
      NEW.id,
      NEW.vendor_id,
      'pending',
      now(),
      NEW.latitude,
      NEW.longitude
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة trigger للتحديث اليدوي
DROP TRIGGER IF EXISTS trigger_add_to_waiting_list_on_update ON orders;
CREATE TRIGGER trigger_add_to_waiting_list_on_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_status_change();

-- ملاحظة: trigger المعالجة التلقائية (BEFORE INSERT) يبقى كما هو
-- ويعمل فقط عند تشغيل المعالجة التلقائية