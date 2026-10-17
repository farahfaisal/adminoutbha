/*
  # إنشاء الجداول المفقودة

  1. الجداول الجديدة
    - `catalog_items` - عناصر كتالوج المنتجات المشتركة
    - `push_notification_logs` - سجلات إشعارات Firebase Push
    - `app_notification_settings` - إعدادات الإشعارات للتطبيق
  
  2. الأمان
    - تفعيل RLS على جميع الجداول
    - سياسات للمسؤولين فقط
  
  3. الفهارس
    - إضافة فهارس لتحسين الأداء
*/

-- جدول عناصر الكتالوج
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES product_catalogs(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  product_name_en text,
  description text,
  description_en text,
  category text,
  base_price numeric NOT NULL DEFAULT 0,
  image_url text,
  variants jsonb DEFAULT '[]'::jsonb,
  addons jsonb DEFAULT '[]'::jsonb,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول سجلات إشعارات Firebase
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_type text CHECK (user_type IN ('customer', 'vendor', 'driver', 'admin')),
  device_token text,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  notification_type text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'opened')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- جدول إعدادات الإشعارات
CREATE TABLE IF NOT EXISTS app_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_type text CHECK (user_type IN ('customer', 'vendor', 'driver', 'admin')),
  notification_type text NOT NULL,
  enabled boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, user_type, notification_type)
);

-- تفعيل RLS
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notification_settings ENABLE ROW LEVEL SECURITY;

-- سياسات catalog_items
CREATE POLICY "المسؤولون يمكنهم قراءة عناصر الكتالوج"
  ON catalog_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المسؤولون يمكنهم إضافة عناصر الكتالوج"
  ON catalog_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المسؤولون يمكنهم تحديث عناصر الكتالوج"
  ON catalog_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المسؤولون يمكنهم حذف عناصر الكتالوج"
  ON catalog_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- سياسات push_notification_logs
CREATE POLICY "المسؤولون يمكنهم قراءة سجلات الإشعارات"
  ON push_notification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المسؤولون يمكنهم إضافة سجلات الإشعارات"
  ON push_notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المسؤولون يمكنهم تحديث سجلات الإشعارات"
  ON push_notification_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- سياسات app_notification_settings
CREATE POLICY "المستخدمون يمكنهم قراءة إعداداتهم"
  ON app_notification_settings FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المستخدمون يمكنهم إدراج إعداداتهم"
  ON app_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "المستخدمون يمكنهم تحديث إعداداتهم"
  ON app_notification_settings FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_catalog_items_catalog_id ON catalog_items(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_display_order ON catalog_items(display_order);
CREATE INDEX IF NOT EXISTS idx_catalog_items_is_active ON catalog_items(is_active);

CREATE INDEX IF NOT EXISTS idx_push_logs_user_id ON push_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_user_type ON push_notification_logs(user_type);
CREATE INDEX IF NOT EXISTS idx_push_logs_status ON push_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_push_logs_created_at ON push_notification_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_app_notif_settings_user ON app_notification_settings(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_app_notif_settings_type ON app_notification_settings(notification_type);

-- التعليقات
COMMENT ON TABLE catalog_items IS 'عناصر كتالوج المنتجات المشتركة بين البائعين';
COMMENT ON TABLE push_notification_logs IS 'سجلات إشعارات Firebase Push';
COMMENT ON TABLE app_notification_settings IS 'إعدادات الإشعارات لكل مستخدم';
