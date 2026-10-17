/*
  # إضافة حالة "قيد المراجعة" للطلبات

  1. التغييرات
    - إضافة حالة 'pending_review' إلى قائمة الحالات المسموحة في جدول orders
    - إضافة حالة 'pending_review' إلى قائمة الحالات المسموحة في جدول order_status_history
    - إضافة حالة 'pending_review' إلى جداول captain_orders و parcel_orders

  2. الوظيفة
    - عندما تكون المعالجة التلقائية معطلة، الطلبات الجديدة تأخذ حالة 'pending_review'
    - بعد موافقة الأدمن، تتحول إلى 'processing' وتظهر للبائع
*/

-- تحديث قيد status في جدول orders
DO $$ BEGIN
  -- حذف القيد القديم إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;

  -- إضافة القيد الجديد مع الحالة الجديدة
  ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
      'pending', 
      'pending_review',
      'accepted', 
      'processing', 
      'ready', 
      'delivering', 
      'completed', 
      'rejected', 
      'cancelled', 
      'waiting-for-driver', 
      'shipping', 
      'delivered'
    ));
END $$;

-- تحديث قيد status في جدول order_status_history
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_status_history_status_check'
  ) THEN
    ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_status_check;
  END IF;

  ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_status_check 
    CHECK (status IN (
      'pending',
      'pending_review',
      'accepted',
      'rejected',
      'processing',
      'waiting-for-driver',
      'delivered-to-driver',
      'delivering',
      'completed',
      'cancelled',
      'shipping',
      'delivered'
    ));
END $$;

-- تحديث قيد status في جدول captain_orders إذا كان موجوداً
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captain_orders') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'captain_orders_status_check'
    ) THEN
      ALTER TABLE captain_orders DROP CONSTRAINT captain_orders_status_check;
    END IF;

    ALTER TABLE captain_orders ADD CONSTRAINT captain_orders_status_check 
      CHECK (status IN (
        'pending',
        'pending_review',
        'accepted',
        'picked_up',
        'in_transit',
        'delivered',
        'cancelled',
        'rejected'
      ));
  END IF;
END $$;

-- تحديث قيد status في جدول parcel_orders إذا كان موجوداً
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parcel_orders') THEN
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
        'accepted',
        'picked_up',
        'in_transit',
        'delivered',
        'cancelled',
        'rejected'
      ));
  END IF;
END $$;