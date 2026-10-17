/*
  # إضافة حقل التخفيضات المجدولة

  1. التغييرات
    - إضافة عمود `scheduled_discounts` من نوع jsonb لجدول products
    - يخزن مصفوفة من التخفيضات مع السعر وتاريخ البداية والنهاية والوصف

  2. الملاحظات
    - الحقل اختياري (nullable)
    - يتم تخزين البيانات بصيغة JSON
    - مثال على البنية:
      [
        {
          "id": "uuid",
          "price": 25.50,
          "start_date": "2024-01-01T00:00:00Z",
          "end_date": "2024-01-31T23:59:59Z",
          "description": "تخفيض شهر يناير"
        }
      ]
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'scheduled_discounts'
  ) THEN
    ALTER TABLE products ADD COLUMN scheduled_discounts jsonb DEFAULT NULL;
  END IF;
END $$;
