/*
  # إزالة الـ trigger العام والاحتفاظ بالإضافة فقط عند المعالجة التلقائية

  1. التغييرات
    - حذف الـ trigger الذي يضيف جميع الطلبات ذات حالة "waiting-for-driver"
    - حذف الدالة auto_add_to_driver_waiting_list
    
  2. السبب
    - النظام يجب أن يضيف الطلبات فقط عند تشغيل المعالجة التلقائية
    - النظام الحالي في auto_process_new_order يتعامل مع هذا بالفعل
*/

-- حذف الـ trigger
DROP TRIGGER IF EXISTS auto_add_to_driver_waiting_list_trigger ON orders;

-- حذف الدالة
DROP FUNCTION IF EXISTS auto_add_to_driver_waiting_list();