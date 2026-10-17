/*
  # إضافة حالة "processing" لطلبات الطرود
  
  ## المشكلة
  - المعالجة التلقائية تحاول تحويل طلبات الطرود من 'pending' إلى 'processing'
  - لكن حالة 'processing' غير موجودة في قائمة الحالات المسموحة لـ parcel_orders
  - هذا يمنع المعالجة التلقائية من العمل بشكل صحيح
  
  ## الحل
  - إضافة حالة 'processing' إلى قائمة الحالات المسموحة في parcel_orders
  - إضافة حالات إضافية للتوافق مع نظام الطلبات العادية
  
  ## الحالات الجديدة
  - processing: جاري التحضير
  - waiting-for-driver: في انتظار سائق
  - delivering: جاري التوصيل
*/

-- تحديث قيد status في جدول parcel_orders
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'parcel_orders_status_check'
  ) THEN
    ALTER TABLE parcel_orders DROP CONSTRAINT parcel_orders_status_check;
  END IF;

  ALTER TABLE parcel_orders ADD CONSTRAINT parcel_orders_status_check 
    CHECK (status IN (
      'pending',
      'pending_review',
      'processing',
      'waiting-for-driver',
      'accepted',
      'picked_up',
      'in_transit',
      'delivering',
      'delivered',
      'completed',
      'cancelled',
      'rejected'
    ));
END $$;

-- تحديث الطلبات التي في حالة pending_review إلى processing إذا كانت المعالجة التلقائية مفعلة
DO $$
DECLARE
  v_auto_processing BOOLEAN;
BEGIN
  -- التحقق من تفعيل المعالجة التلقائية
  SELECT (settings->'orders'->>'autoProcessing')::boolean INTO v_auto_processing
  FROM app_settings
  LIMIT 1;
  
  -- إذا كانت مفعلة، نحول الطلبات pending_review إلى processing
  IF v_auto_processing = true THEN
    UPDATE parcel_orders
    SET status = 'processing', updated_at = now()
    WHERE status = 'pending_review';
    
    RAISE NOTICE 'تم تحديث % طلب طرد من pending_review إلى processing', 
      (SELECT COUNT(*) FROM parcel_orders WHERE status = 'processing');
  END IF;
END $$;
