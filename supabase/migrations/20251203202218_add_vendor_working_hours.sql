/*
  # إضافة أوقات الدوام للبائعين

  ## التغييرات
  
  1. إضافة أعمدة جديدة لجدول vendors:
     - `working_hours` (jsonb): أوقات العمل لكل يوم من أيام الأسبوع
     - `holidays` (jsonb): العطل والإجازات
     - `auto_status_change` (boolean): تفعيل/إيقاف التغيير التلقائي للحالة
     - `timezone` (text): المنطقة الزمنية للمتجر
  
  2. الهيكل المتوقع لـ working_hours:
     ```json
     {
       "saturday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "sunday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "monday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "tuesday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "wednesday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "thursday": { "enabled": true, "open": "08:00", "close": "22:00" },
       "friday": { "enabled": false, "open": null, "close": null }
     }
     ```
  
  3. الهيكل المتوقع لـ holidays:
     ```json
     [
       { "date": "2025-12-25", "name": "عيد الميلاد", "type": "holiday" },
       { "start_date": "2025-07-01", "end_date": "2025-07-15", "name": "إجازة صيفية", "type": "vacation" }
     ]
     ```
*/

-- إضافة أعمدة أوقات العمل إلى جدول vendors
DO $$ 
BEGIN
  -- إضافة عمود أوقات العمل
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'working_hours'
  ) THEN
    ALTER TABLE vendors ADD COLUMN working_hours jsonb DEFAULT jsonb_build_object(
      'saturday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'sunday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'monday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'tuesday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'wednesday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'thursday', jsonb_build_object('enabled', true, 'open', '08:00', 'close', '22:00'),
      'friday', jsonb_build_object('enabled', false, 'open', null, 'close', null)
    );
  END IF;

  -- إضافة عمود العطل
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'holidays'
  ) THEN
    ALTER TABLE vendors ADD COLUMN holidays jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- إضافة عمود التغيير التلقائي للحالة
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'auto_status_change'
  ) THEN
    ALTER TABLE vendors ADD COLUMN auto_status_change boolean DEFAULT true;
  END IF;

  -- إضافة عمود المنطقة الزمنية
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE vendors ADD COLUMN timezone text DEFAULT 'Asia/Gaza';
  END IF;
END $$;

-- إضافة تعليق على الأعمدة
COMMENT ON COLUMN vendors.working_hours IS 'أوقات العمل لكل يوم من أيام الأسبوع بصيغة JSON';
COMMENT ON COLUMN vendors.holidays IS 'قائمة العطل والإجازات بصيغة JSON';
COMMENT ON COLUMN vendors.auto_status_change IS 'تفعيل التغيير التلقائي لحالة المتجر حسب أوقات العمل';
COMMENT ON COLUMN vendors.timezone IS 'المنطقة الزمنية للمتجر (مثال: Asia/Gaza, Asia/Jerusalem)';
