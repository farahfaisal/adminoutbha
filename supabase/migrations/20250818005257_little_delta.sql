/*
  # إضافة حقول النقاط إلى جدول الطلبات

  1. تحديثات الجدول
    - إضافة حقل `points_applied` لتخزين عدد النقاط المستخدمة
    - إضافة حقل `points_discount` لتخزين قيمة الخصم بالنقاط
    - إضافة حقل `redemption_code` لربط الطلب بكود الاستبدال

  2. الفهارس
    - إضافة فهارس للحقول الجديدة لتحسين الأداء

  3. التحديثات
    - تحديث الجدول الموجود بالحقول الجديدة
*/

-- إضافة الحقول الجديدة إلى جدول الطلبات إذا لم تكن موجودة
DO $$
BEGIN
  -- إضافة حقل النقاط المطبقة
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'points_applied'
  ) THEN
    ALTER TABLE orders ADD COLUMN points_applied integer DEFAULT 0;
  END IF;

  -- إضافة حقل خصم النقاط
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'points_discount'
  ) THEN
    ALTER TABLE orders ADD COLUMN points_discount numeric(10,2) DEFAULT 0;
  END IF;

  -- إضافة حقل كود الاستبدال
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'redemption_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN redemption_code text;
  END IF;
END $$;

-- إضافة فهارس للحقول الجديدة
CREATE INDEX IF NOT EXISTS idx_orders_points_applied ON orders(points_applied);
CREATE INDEX IF NOT EXISTS idx_orders_points_discount ON orders(points_discount);
CREATE INDEX IF NOT EXISTS idx_orders_redemption_code ON orders(redemption_code);