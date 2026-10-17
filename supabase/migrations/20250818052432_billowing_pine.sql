/*
  # إنشاء جدول إعدادات طرق الدفع

  1. الجداول الجديدة
    - `payment_methods_config`
      - `id` (uuid, primary key)
      - `name` (text, اسم طريقة الدفع)
      - `type` (text, نوع طريقة الدفع)
      - `description` (text, وصف طريقة الدفع)
      - `status` (text, حالة طريقة الدفع)
      - `settings` (jsonb, إعدادات إضافية)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. الأمان
    - تفعيل RLS على جدول `payment_methods_config`
    - إضافة صلاحيات للمديرين لإدارة طرق الدفع
    - إضافة صلاحيات للعرض العام

  3. البيانات الافتراضية
    - إضافة طرق الدفع الأساسية (نقدي، إلكتروني، محفظة)
*/

-- إنشاء جدول إعدادات طرق الدفع
CREATE TABLE IF NOT EXISTS payment_methods_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('cash', 'electronic', 'wallet', 'traditional')),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE payment_methods_config ENABLE ROW LEVEL SECURITY;

-- إضافة صلاحيات
CREATE POLICY "Payment methods are viewable by everyone"
  ON payment_methods_config
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage payment methods"
  ON payment_methods_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- إضافة البيانات الافتراضية
INSERT INTO payment_methods_config (name, type, description, status, settings) VALUES
(
  'الدفع النقدي',
  'cash',
  'الدفع عند الاستلام نقداً',
  'active',
  '{
    "icon": "💰",
    "color": "green",
    "steps": [
      "العميل يطلب المنتج",
      "البائع يحضر الطلب",
      "السائق يستلم الطلب",
      "العميل يدفع نقداً عند الاستلام"
    ],
    "note": "طريقة الدفع الأكثر شيوعاً - الدفع عند الاستلام"
  }'
),
(
  'الدفع الإلكتروني',
  'electronic',
  'الدفع المسبق عبر البطاقات الائتمانية أو التحويل البنكي',
  'active',
  '{
    "icon": "💳",
    "color": "blue",
    "steps": [
      "العميل يختار المنتجات",
      "العميل يدفع مسبقاً عبر البطاقة",
      "البائع يحضر الطلب",
      "السائق يوصل الطلب مدفوع مسبقاً"
    ],
    "note": "دفع آمن ومضمون - لا حاجة للنقد عند التوصيل"
  }'
),
(
  'محفظة التطبيق',
  'wallet',
  'الدفع من رصيد المحفظة الإلكترونية',
  'active',
  '{
    "icon": "👛",
    "color": "purple",
    "steps": [
      "العميل يشحن محفظته مسبقاً",
      "العميل يختار المنتجات",
      "خصم تلقائي من رصيد المحفظة",
      "السائق يوصل الطلب مدفوع مسبقاً"
    ],
    "note": "سريع ومريح - دفع فوري من رصيد المحفظة"
  }'
),
(
  'المحفظة التقليدية',
  'traditional',
  'الدفع عند الاستلام من رصيد المحفظة',
  'active',
  '{
    "icon": "🏦",
    "color": "orange",
    "steps": [
      "العميل يطلب المنتج",
      "البائع يحضر الطلب",
      "السائق يستلم الطلب",
      "خصم من محفظة العميل عند التوصيل"
    ],
    "note": "مرونة في الدفع - خصم من المحفظة عند الاستلام"
  }'
);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_payment_methods_config_type ON payment_methods_config(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_config_status ON payment_methods_config(status);

-- إضافة trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_methods_config_updated_at
  BEFORE UPDATE ON payment_methods_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_config_updated_at();