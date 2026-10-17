/*
  # إنشاء جدول إعدادات التطبيق وإصلاح المعالجة التلقائية

  1. الجداول الجديدة
    - `app_settings` - جدول لحفظ إعدادات التطبيق
      - `id` (uuid, primary key)
      - `settings` (jsonb) - الإعدادات بصيغة JSON
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. الأمان
    - تفعيل RLS على الجدول
    - السماح للمديرين بقراءة وتعديل الإعدادات
    - السماح لجميع المستخدمين المصادقين بقراءة الإعدادات

  3. الإصلاحات
    - إنشاء الجدول إذا لم يكن موجوداً
    - إضافة سطر افتراضي مع المعالجة التلقائية معطلة
    - تحديث دالة auto_process_new_order لتتأكد من قراءة الإعدادات بشكل صحيح
*/

-- إنشاء جدول app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;

-- السماح لجميع المستخدمين بقراءة الإعدادات
CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- السماح للمديرين بتعديل الإعدادات
CREATE POLICY "Admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- السماح للمديرين بإضافة إعدادات
CREATE POLICY "Admins can insert app settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- إضافة البيانات الافتراضية
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1) THEN
    INSERT INTO app_settings (settings)
    VALUES ('{
      "store": {
        "name": "متجر خدماتكم",
        "description": "نظام متكامل لإدارة المتجر",
        "email": "info@example.com",
        "phone": "0599123456",
        "address": "غزة، فلسطين",
        "currency": "ILS",
        "language": "ar"
      },
      "orders": {
        "autoProcessing": false,
        "defaultPreparationTime": 15,
        "notifyDrivers": true,
        "autoUpdateStatus": true
      },
      "social": {
        "facebook": "",
        "twitter": "",
        "instagram": "",
        "whatsapp": ""
      },
      "notifications": {
        "email": true,
        "sms": false,
        "push": true
      }
    }'::jsonb);

    RAISE NOTICE 'تم إضافة الإعدادات الافتراضية بنجاح - المعالجة التلقائية معطلة';
  ELSE
    UPDATE app_settings
    SET settings = jsonb_set(
      settings,
      '{orders,autoProcessing}',
      'false'::jsonb,
      true
    )
    WHERE settings->'orders'->>'autoProcessing' IS NULL;

    RAISE NOTICE 'تم التحقق من الإعدادات الحالية';
  END IF;
END $$;

-- تحديث دالة المعالجة التلقائية
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_has_status_history BOOLEAN;
BEGIN
  BEGIN
    SELECT settings INTO v_settings
    FROM app_settings
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_settings := NULL;
    RAISE NOTICE 'فشل في قراءة إعدادات app_settings - المعالجة التلقائية معطلة';
  END;

  IF v_settings IS NULL THEN
    v_auto_processing := false;
    RAISE NOTICE 'لا توجد إعدادات - المعالجة التلقائية معطلة';
  ELSE
    v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
    RAISE NOTICE 'حالة المعالجة التلقائية: %', v_auto_processing;
  END IF;

  IF v_auto_processing = true AND NEW.status = 'pending' THEN
    RAISE NOTICE 'تحويل الطلب من pending إلى processing تلقائياً';

    NEW.status := 'processing';
    NEW.updated_at := now();

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = TG_TABLE_NAME
      AND column_name = 'status_history'
    ) INTO v_has_status_history;

    IF v_has_status_history THEN
      IF TG_TABLE_NAME = 'parcel_orders' THEN
        NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) ||
          jsonb_build_object(
            'status', 'processing',
            'timestamp', now(),
            'note', 'تم القبول تلقائياً وجاري التحضير'
          );
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'orders' THEN
      INSERT INTO order_status_history (order_id, status, note, created_at)
      VALUES (
        NEW.id,
        'processing',
        'تم القبول تلقائياً وجاري التحضير',
        now()
      );
    END IF;
  ELSE
    RAISE NOTICE 'الطلب سيبقى بحالة pending - المعالجة التلقائية معطلة (autoProcessing: %)', v_auto_processing;
  END IF;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ triggers
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
CREATE TRIGGER auto_process_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_process_captain_order_trigger ON captain_orders;
CREATE TRIGGER auto_process_captain_order_trigger
  BEFORE INSERT ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();

DROP TRIGGER IF EXISTS auto_process_parcel_order_trigger ON parcel_orders;
CREATE TRIGGER auto_process_parcel_order_trigger
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_new_order();
