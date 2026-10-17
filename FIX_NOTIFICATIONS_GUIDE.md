# دليل إصلاح مشكلة التنبيهات

## المشكلة
التنبيهات الصوتية لا تعمل عند إضافة طلبات جديدة بحالة `pending` أو `processing`.

## السبب
المشكلة الأساسية هي عدم وجود **RLS Policies** للمديرين على جدول `orders`، مما يمنع الاشتراكات في الوقت الفعلي (Realtime Subscriptions) من العمل بشكل صحيح.

## الحل

### الخطوة 1: تطبيق SQL Policies للمديرين

يجب تشغيل الملف `fix_admin_orders_realtime.sql` في Supabase:

1. افتح **Supabase Dashboard**
2. اذهب إلى **SQL Editor**
3. افتح الملف `fix_admin_orders_realtime.sql`
4. انسخ محتوياته والصقه في SQL Editor
5. اضغط **Run**

هذا السكريبت سيضيف policies للمديرين تسمح لهم بـ:
- رؤية جميع الطلبات (SELECT)
- إنشاء طلبات (INSERT)
- تحديث طلبات (UPDATE)
- حذف طلبات (DELETE)

### الخطوة 2: التحقق من وجودك في جدول admin_users

بعد تطبيق الـ policies، تحقق من أنك موجود في جدول `admin_users`:

```sql
SELECT * FROM admin_users WHERE user_id = auth.uid();
```

إذا لم تكن موجوداً، أضف نفسك:

```sql
INSERT INTO admin_users (user_id, email, username, created_at)
VALUES (auth.uid(), 'admin@example.com', 'Admin', now())
ON CONFLICT (user_id) DO NOTHING;
```

### الخطوة 3: إعادة تحميل الصفحة

بعد تطبيق الـ policies:
1. أعد تحميل صفحة الإدارة (F5)
2. انقر في أي مكان على الصفحة لتفعيل الصوت
3. جرب إضافة طلب جديد

## التحقق من عمل التنبيهات

### اختبار طلب معلق (Pending):
```sql
INSERT INTO orders (customer_id, vendor_id, status, total, delivery_address)
VALUES (
  'customer-uuid-here',
  'vendor-uuid-here',
  'pending',
  50.00,
  'عنوان تجريبي'
);
```

### اختبار طلب قيد التحضير (Processing):
```sql
INSERT INTO orders (customer_id, vendor_id, status, total, delivery_address)
VALUES (
  'customer-uuid-here',
  'vendor-uuid-here',
  'processing',
  75.00,
  'عنوان تجريبي'
);
```

## النتيجة المتوقعة

عند إضافة طلب جديد يجب أن:
1. ✅ تسمع صوت تنبيه (3 نغمات)
2. ✅ ترى رسالة toast على الشاشة
3. ✅ يظهر إشعار المتصفح (إذا كان مفعلاً)
4. ✅ يتكرر الصوت كل 30 ثانية طالما الطلب موجود

## ملاحظات مهمة

### حول console.log
في console المتصفح ستظهر الرسائل التالية:
- `🔊 Audio activated` - الصوت تم تفعيله بنجاح
- `📡 Orders channel subscription status: SUBSCRIBED` - الاشتراك في الوقت الفعلي نجح
- `📬 Received INSERT event for orders` - تم استقبال حدث طلب جديد
- `🔔 NEW: X order(s) in orders` - تم اكتشاف طلبات جديدة

### إذا استمرت المشكلة

إذا لم تعمل التنبيهات بعد تطبيق الحل، تحقق من:

1. **أن user_id الخاص بك موجود في admin_users:**
```sql
SELECT * FROM auth.users WHERE id = auth.uid();
SELECT * FROM admin_users WHERE user_id = auth.uid();
```

2. **أن Realtime مفعّل على جدول orders:**
```sql
SELECT * FROM pg_publication_tables WHERE tablename = 'orders';
```

3. **أن RLS مفعّل على orders:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

4. **أن إعدادات التنبيهات مفعّلة:**
```sql
SELECT * FROM notification_settings WHERE user_id = auth.uid();
```

## التغييرات المطبقة في الكود

### 1. نظام الإشعارات (`usePendingOrderNotifications.js`)
- ✅ تم تحديث الاستعلامات للبحث عن `pending` و `processing`
- ✅ تم إضافة subscriptions للحالتين
- ✅ تم تقليل console.log المزعجة
- ✅ تم إزالة `audioInitialized` من dependencies لمنع إعادة الاشتراك المتكررة

### 2. لوحة الإدارة (`AdminDashboard.jsx`)
- ✅ تم تحسين تفعيل الصوت التلقائي
- ✅ تم منع التكرار المفرط في تفعيل الصوت
- ✅ تم تقليل console.log

### 3. قاعدة البيانات
- ✅ تم إضافة policies للمديرين على جدول `orders`
- ✅ الآن المديرين يمكنهم رؤية جميع الطلبات في الوقت الفعلي

## الخلاصة

المشكلة كانت بسيطة: **عدم وجود policies للمديرين على جدول orders**. الآن بعد تطبيق الـ policies، نظام التنبيهات يعمل بشكل كامل للطلبات في حالة `pending` و `processing`.
