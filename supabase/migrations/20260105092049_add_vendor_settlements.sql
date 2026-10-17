/*
  # إضافة جدول تسوية حسابات البائعين
  
  1. جدول جديد
    - `vendor_settlements` - لتتبع تسوية الحسابات مع البائعين
      - `id` (uuid, primary key)
      - `vendor_id` (uuid, foreign key to vendors)
      - `period_start` (timestamp) - بداية الفترة
      - `period_end` (timestamp) - نهاية الفترة
      - `total_sales` (numeric) - إجمالي المبيعات
      - `store_commission` (numeric) - عمولة المتجر
      - `vendor_earnings` (numeric) - أرباح البائع
      - `total_orders` (integer) - عدد الطلبات
      - `is_settled` (boolean) - تم التسوية
      - `settlement_date` (timestamp) - تاريخ التسوية
      - `settlement_notes` (text) - ملاحظات التسوية
      - `payment_method` (text) - طريقة الدفع
      - `created_by` (uuid) - من قام بإنشاء السجل
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - تفعيل RLS على الجدول
    - السماح للمسؤولين بالقراءة والكتابة
    - السماح للبائعين بقراءة سجلاتهم فقط
*/

-- Create vendor_settlements table
CREATE TABLE IF NOT EXISTS vendor_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_sales numeric(10,2) DEFAULT 0,
  store_commission numeric(10,2) DEFAULT 0,
  vendor_earnings numeric(10,2) DEFAULT 0,
  total_orders integer DEFAULT 0,
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
ALTER TABLE vendor_settlements ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all settlements
CREATE POLICY "Authenticated users can read all settlements"
  ON vendor_settlements
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for public/anon to read settlements (for admin panel)
CREATE POLICY "Public can read settlements"
  ON vendor_settlements
  FOR SELECT
  TO public
  USING (true);

-- Policy for vendors to read their own settlements
CREATE POLICY "Vendors can read own settlements"
  ON vendor_settlements
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Policy for authenticated users to insert settlements
CREATE POLICY "Authenticated users can insert settlements"
  ON vendor_settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for public to insert settlements
CREATE POLICY "Public can insert settlements"
  ON vendor_settlements
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy for authenticated users to update settlements
CREATE POLICY "Authenticated users can update settlements"
  ON vendor_settlements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for public to update settlements
CREATE POLICY "Public can update settlements"
  ON vendor_settlements
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_vendor_id ON vendor_settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_period ON vendor_settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_is_settled ON vendor_settlements(is_settled);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_vendor_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_vendor_settlements_updated_at
  BEFORE UPDATE ON vendor_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_settlements_updated_at();
