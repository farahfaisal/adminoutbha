/*
  # إصلاح قيد status في جدول driver_waiting_list
  
  1. التغييرات
    - حذف القيد القديم على عمود status
    - إضافة قيد جديد يشمل جميع الحالات المطلوبة بما فيها 'waiting-for-driver'
  
  2. الحالات المسموحة الجديدة
    - pending: في انتظار القبول
    - preparing: قيد التحضير
    - preparing_pending_vendor: في انتظار البائع
    - accepted: مقبول
    - ready: جاهز
    - rejected: مرفوض
    - waiting-for-driver: في انتظار السائق
    - processing: قيد المعالجة
*/

-- حذف القيد القديم
ALTER TABLE driver_waiting_list 
DROP CONSTRAINT IF EXISTS driver_waiting_list_status_check;

-- إضافة القيد الجديد مع جميع الحالات المطلوبة
ALTER TABLE driver_waiting_list 
ADD CONSTRAINT driver_waiting_list_status_check 
CHECK (status IN (
  'pending',
  'preparing',
  'preparing_pending_vendor',
  'accepted',
  'ready',
  'rejected',
  'waiting-for-driver',
  'processing'
));
