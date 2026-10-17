-- =============================================
-- إضافة AFTER UPDATE trigger للتأكد من إضافة
-- الطلبات إلى driver_waiting_list عند التحديث اليدوي
-- =============================================

/*
  الهدف:
  - التأكد من إضافة أي طلب يتم تحويله يدوياً إلى processing
  - سواء كان التحويل من pending أو أي حالة أخرى
  - يعمل مع AFTER INSERT trigger الموجود

  السيناريوهات:
  1. طلب جديد → BEFORE INSERT (auto_process) → AFTER INSERT (auto_add)
  2. تحويل يدوي → AFTER UPDATE (add_on_manual_update)
*/

-- =============================================
-- الدالة: إضافة إلى driver_waiting_list عند التحديث
-- =============================================

CREATE OR REPLACE FUNCTION add_to_waiting_list_on_manual_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_exists BOOLEAN;
BEGIN
  -- الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;

  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);

  -- فقط إذا:
  -- 1. المعالجة التلقائية مفعلة
  -- 2. الحالة القديمة ليست processing
  -- 3. الحالة الجديدة هي processing
  -- 4. لا يوجد سائق مُعين للطلب
  IF v_auto_processing
     AND OLD.status != 'processing'
     AND NEW.status = 'processing'
     AND NEW.driver_id IS NULL THEN

    IF TG_TABLE_NAME = 'orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          order_id, vendor_id, total, status, created_at
        ) VALUES (
          NEW.id, NEW.vendor_id, COALESCE(NEW.total, 0), 'pending', now()
        );

        RAISE NOTICE 'تمت إضافة الطلب % إلى driver_waiting_list عند التحديث اليدوي', NEW.order_number;
      END IF;

    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          captain_order_id, vendor_id, total, status, created_at
        ) VALUES (
          NEW.id, NULL, COALESCE(NEW.delivery_fee, 0), 'pending', now()
        );

        RAISE NOTICE 'تمت إضافة طلب الكابتن % إلى driver_waiting_list عند التحديث اليدوي', NEW.order_number;
      END IF;

    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          parcel_order_id, vendor_id, total, status, created_at,
          geocoded_latitude, geocoded_longitude
        ) VALUES (
          NEW.id, NULL, COALESCE(NEW.delivery_fee, 0), 'pending', now(),
          NEW.sender_latitude, NEW.sender_longitude
        );

        RAISE NOTICE 'تمت إضافة طلب الطرد % إلى driver_waiting_list عند التحديث اليدوي', NEW.order_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- إنشاء AFTER UPDATE triggers
-- =============================================

-- حذف الـ triggers القديمة إن وُجدت
DROP TRIGGER IF EXISTS add_to_waiting_on_manual_update_trigger ON orders;
DROP TRIGGER IF EXISTS add_captain_to_waiting_on_manual_update_trigger ON captain_orders;
DROP TRIGGER IF EXISTS add_parcel_to_waiting_on_manual_update_trigger ON parcel_orders;

-- إنشاء triggers جديدة
CREATE TRIGGER add_to_waiting_on_manual_update_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_manual_update();

CREATE TRIGGER add_captain_to_waiting_on_manual_update_trigger
  AFTER UPDATE OF status ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_manual_update();

CREATE TRIGGER add_parcel_to_waiting_on_manual_update_trigger
  AFTER UPDATE OF status ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_manual_update();

-- =============================================
-- التحقق من إنشاء الـ triggers
-- =============================================

SELECT
  'الـ Triggers المُنشأة' as info,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN 'مفعل ✅'
    WHEN 'D' THEN 'معطل ❌'
    ELSE 'حالة أخرى'
  END as status,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgname IN (
  'add_to_waiting_on_manual_update_trigger',
  'add_captain_to_waiting_on_manual_update_trigger',
  'add_parcel_to_waiting_on_manual_update_trigger'
)
ORDER BY tgname;

-- =============================================
-- اختبار الـ trigger
-- =============================================

-- يمكنك اختبار الـ trigger بتحديث طلب موجود:
-- UPDATE orders SET status = 'processing' WHERE order_number = 'ORD-211836';
-- ثم التحقق من driver_waiting_list

COMMENT ON FUNCTION add_to_waiting_list_on_manual_update IS 'إضافة الطلبات إلى driver_waiting_list عند التحويل اليدوي إلى processing';
