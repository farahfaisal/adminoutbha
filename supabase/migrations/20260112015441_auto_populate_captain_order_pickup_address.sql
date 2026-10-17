/*
  # ملء عنوان الاستلام تلقائياً في طلبات الكابتن
  
  1. الوظيفة
    - إنشاء trigger يتم تفعيله عند إضافة طلب كابتن جديد
    - إذا كان pickup_address فارغاً، يتم جلب العنوان من جدول vendors تلقائياً
    
  2. التفاصيل
    - عند إنشاء طلب كابتن جديد، إذا لم يتم تحديد pickup_address
    - يتم البحث عن المتجر باستخدام vendor_id
    - يتم نسخ عنوان المتجر (address) إلى pickup_address تلقائياً
    
  3. الفوائد
    - توفير الوقت والجهد في إدخال عنوان الاستلام
    - ضمان دقة عنوان الاستلام
    - تجنب الأخطاء في إدخال العنوان يدوياً
*/

-- إنشاء دالة لملء عنوان الاستلام تلقائياً
CREATE OR REPLACE FUNCTION auto_populate_captain_order_pickup_address()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان pickup_address فارغاً أو null وthere is a vendor_id
  IF (NEW.pickup_address IS NULL OR NEW.pickup_address = '') AND NEW.vendor_id IS NOT NULL THEN
    -- جلب عنوان المتجر من جدول vendors
    SELECT address INTO NEW.pickup_address
    FROM vendors
    WHERE id = NEW.vendor_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- حذف الـ trigger إذا كان موجوداً مسبقاً
DROP TRIGGER IF EXISTS trigger_auto_populate_captain_order_pickup_address ON captain_orders;

-- إنشاء الـ trigger
CREATE TRIGGER trigger_auto_populate_captain_order_pickup_address
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_captain_order_pickup_address();

-- تحديث الطلبات الموجودة التي ليس لديها pickup_address
UPDATE captain_orders co
SET pickup_address = v.address
FROM vendors v
WHERE co.vendor_id = v.id
  AND (co.pickup_address IS NULL OR co.pickup_address = '')
  AND v.address IS NOT NULL;