/*
  # تعطيل الـ triggers المشبوهة مؤقتاً للتشخيص
  
  1. التغييرات
    - تعطيل on_admin_accept_order_trigger مؤقتاً
    - إضافة logging للتشخيص
*/

-- تعطيل الـ trigger مؤقتاً
ALTER TABLE orders DISABLE TRIGGER on_admin_accept_order_trigger;

-- إضافة دالة logging
CREATE OR REPLACE FUNCTION log_order_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE NOTICE '🔍 تغيير حالة الطلب %: من % إلى %', NEW.order_number, OLD.status, NEW.status;
    RAISE NOTICE '🔍 تم التغيير بواسطة: %', current_user;
    RAISE NOTICE '🔍 الطلب ID: %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- إنشاء trigger للـ logging
DROP TRIGGER IF EXISTS log_order_changes_trigger ON orders;
CREATE TRIGGER log_order_changes_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_changes();
