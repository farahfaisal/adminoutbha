/*
  # جعل حقل total في driver_waiting_list nullable

  1. المشكلة
    - حقل total في driver_waiting_list مطلوب (NOT NULL)
    - عند إضافة طلبات الكابتن والطرود، قد لا يكون total متاحاً مباشرة
    
  2. الحل
    - جعل total nullable
    - تحديث القيمة الافتراضية إلى 0
*/

-- جعل total nullable
ALTER TABLE driver_waiting_list
ALTER COLUMN total DROP NOT NULL,
ALTER COLUMN total SET DEFAULT 0;