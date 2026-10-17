/*
  # إنشاء جدول تسوية حسابات السائقين (Driver Settlements)

  1. جدول جديد: `driver_settlements`
    - `id` (uuid, primary key)
    - `driver_id` (uuid, foreign key -> drivers)
    - `period_start` (timestamptz) - بداية الفترة المحاسبية
    - `period_end` (timestamptz) - نهاية الفترة المحاسبية
    - `total_delivery_fees` (numeric) - إجمالي رسوم التوصيل
    - `store_commission` (numeric) - عمولة المتجر
    - `driver_earnings` (numeric) - أرباح السائق
    - `total_trips` (integer) - عدد الرحلات
    - `commission_rate` (numeric) - نسبة العمولة
    - `is_settled` (boolean) - حالة التسوية
    - `settlement_date` (timestamptz) - تاريخ التسوية
    - `settlement_notes` (text) - ملاحظات
    - `payment_method` (text) - طريقة الدفع
    - `created_by` (uuid) - المستخدم الذي أنشأ السجل
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على الجدول
    - سياسات قراءة وكتابة للمستخدمين المصادق عليهم
    - سياسة قراءة عامة للوحة التحكم
*/

-- Create driver_settlements table
CREATE TABLE IF NOT EXISTS driver_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_delivery_fees numeric(10,2) DEFAULT 0,
  store_commission numeric(10,2) DEFAULT 0,
  driver_earnings numeric(10,2) DEFAULT 0,
  total_trips integer DEFAULT 0,
  commission_rate numeric(5,2) DEFAULT 10,
  is_settled boolean DEFAULT false,
  settlement_date timestamptz,
  settlement_notes text,
  payment_method text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE driver_settlements ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all settlements
CREATE POLICY "Authenticated users can read all driver settlements"
  ON driver_settlements
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for public/anon to read settlements (for admin panel)
CREATE POLICY "Public can read driver settlements"
  ON driver_settlements
  FOR SELECT
  TO anon
  USING (true);

-- Policy for authenticated users to insert settlements
CREATE POLICY "Authenticated users can insert driver settlements"
  ON driver_settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for public/anon to insert settlements (for admin panel)
CREATE POLICY "Public can insert driver settlements"
  ON driver_settlements
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy for authenticated users to update settlements
CREATE POLICY "Authenticated users can update driver settlements"
  ON driver_settlements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for public/anon to update settlements (for admin panel)
CREATE POLICY "Public can update driver settlements"
  ON driver_settlements
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver_id ON driver_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_period ON driver_settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_is_settled ON driver_settlements(is_settled);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_settlements_updated_at_trigger
  BEFORE UPDATE ON driver_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_settlements_updated_at();
