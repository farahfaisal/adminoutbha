# Migration: نظام ترقيم الطلبات التلقائي

## نظرة عامة
تم إضافة نظام ترقيم تلقائي للطلبات يبدأ من الرقم 1 ويزيد تلقائياً مع كل طلب جديد.

## ما تم إنجازه

### 1. ترقيم الطلبات الموجودة ✅
- تم ترقيم جميع الطلبات الموجودة في قاعدة البيانات
- الطلبات متعددة المتاجر (نفس `order_group_id`) تحصل على نفس الرقم
- الترقيم يبدأ من 1 بناءً على تاريخ إنشاء الطلب

### 2. عرض رقم الطلب في الواجهة ✅
- تم إضافة عمود "رقم الطلب" في صفحة الطلبات
- يظهر رقم الطلب في أول عمود في جدول الطلبات

### 3. تجميع الطلبات متعددة المتاجر ✅
- الطلبات من نفس المجموعة (`order_group_id`) تظهر كطلب واحد
- يتم جمع المبلغ الإجمالي لجميع المتاجر
- تظهر أسماء جميع المتاجر المشاركة

## Migration SQL للترقيم التلقائي للطلبات الجديدة

لإضافة ترقيم تلقائي للطلبات الجديدة، يجب تنفيذ الـ SQL التالي في قاعدة بيانات Supabase:

```sql
/*
  # إضافة نظام ترقيم تلقائي للطلبات الجديدة

  1. التغييرات
    - إنشاء sequence لتوليد أرقام متسلسلة للطلبات
    - إنشاء دالة لترقيم الطلبات تلقائياً
    - إنشاء trigger لتطبيق الترقيم على الطلبات الجديدة

  2. ملاحظات مهمة
    - الطلبات متعددة المتاجر (نفس order_group_id) تحصل على نفس الرقم
    - الترقيم يستمر تلقائياً من آخر رقم مستخدم
*/

-- إنشاء sequence لتوليد أرقام الطلبات
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 4;

-- دالة لتوليد رقم الطلب التالي
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
BEGIN
  next_number := nextval('order_number_seq');
  RETURN next_number::TEXT;
END;
$$ LANGUAGE plpgsql;

-- دالة لتعيين رقم الطلب تلقائياً
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
DECLARE
  group_order_number TEXT;
BEGIN
  -- إذا كان الطلب متعدد المتاجر ولديه order_group_id
  IF NEW.is_multi_vendor = true AND NEW.order_group_id IS NOT NULL THEN
    -- تحقق إذا كان هناك طلب آخر بنفس المجموعة لديه رقم بالفعل
    SELECT order_number INTO group_order_number
    FROM orders
    WHERE order_group_id = NEW.order_group_id
      AND order_number IS NOT NULL
    LIMIT 1;

    -- إذا وجد رقم للمجموعة، استخدمه
    IF group_order_number IS NOT NULL THEN
      NEW.order_number := group_order_number;
    ELSE
      -- إذا لم يوجد، أنشئ رقم جديد
      NEW.order_number := generate_order_number();
    END IF;
  ELSE
    -- للطلبات العادية، أنشئ رقم جديد
    IF NEW.order_number IS NULL THEN
      NEW.order_number := generate_order_number();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- حذف trigger إذا كان موجوداً
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;

-- إنشاء trigger لتطبيق الترقيم على الطلبات الجديدة
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();

-- تحديث sequence ليبدأ من الرقم التالي
-- ملاحظة: يجب تغيير الرقم 4 إلى الرقم المناسب بناءً على آخر رقم طلب موجود + 1
SELECT setval('order_number_seq', 4);
```

## كيفية تطبيق Migration

### الطريقة 1: من خلال Supabase Dashboard
1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. انسخ والصق SQL أعلاه
4. قم بتغيير الرقم في `START WITH` و `setval` إلى الرقم المناسب (آخر رقم طلب + 1)
5. اضغط Run

### الطريقة 2: إنشاء ملف Migration يدوياً
1. أنشئ ملف جديد في `supabase/migrations/`
2. سمّ الملف: `[timestamp]_add_order_auto_numbering.sql`
3. انسخ محتوى SQL أعلاه إلى الملف
4. سيتم تطبيقه تلقائياً

## التحقق من عمل النظام

بعد تطبيق Migration، قم بإنشاء طلب اختبار وتحقق:
1. تم إنشاء الطلب برقم تلقائي
2. الرقم متسلسل ومتزايد
3. الطلبات متعددة المتاجر لها نفس الرقم

## الملفات المتأثرة

### Frontend
- `src/components/Pages/Orders.jsx` - عرض رقم الطلب في الجدول

### Backend/Scripts
- `add-order-numbering.js` - سكريبت ترقيم الطلبات الموجودة (تم تشغيله)

## معلومات إضافية

- آخر رقم طلب مستخدم: 3
- عدد الطلبات المرقمة: 3
- رقم الطلب التالي: 4
