# تطبيق Migration لمناطق الخدمة مع المناطق الفرعية

## خطوات التطبيق

1. افتح Supabase Dashboard: https://supabase.com/dashboard/project/fliwyntfvfedslbwkvks
2. اذهب إلى SQL Editor
3. قم بتطبيق الملفات التالية بالترتيب:
   - `supabase/migrations/20251124000003_fix_service_areas.sql`
   - `supabase/migrations/20251124000004_add_sub_areas.sql`

## البنية الهرمية:
- المناطق الرئيسية (parent_id = NULL): القدس، رام الله، بيت لحم...
- المناطق الفرعية (parent_id = معرف المنطقة الرئيسية): المركز، البلدة القديمة...

## النتيجة:
- 8 مناطق رئيسية (مدن)
- 24 منطقة فرعية
- يختار البائع المناطق الفرعية فقط
- سعر توصيل مخصص لكل منطقة فرعية
