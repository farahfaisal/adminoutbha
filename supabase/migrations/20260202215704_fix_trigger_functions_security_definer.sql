/*
  # إصلاح SECURITY على trigger functions

  1. المشكلة
    - Trigger functions تستخدم SECURITY INVOKER
    - عند إدراج طلب، triggers تحاول الكتابة في جداول أخرى بصلاحيات المستخدم
    - المستخدم العادي ليس لديه صلاحيات للكتابة في هذه الجداول

  2. الحل
    - تحويل جميع trigger functions إلى SECURITY DEFINER
    - هذا يسمح للـ functions بالعمل بصلاحيات صاحب الـ function (postgres)
*/

-- تحويل جميع trigger functions إلى SECURITY DEFINER
ALTER FUNCTION auto_insert_status_history() SECURITY DEFINER;
ALTER FUNCTION grant_referral_rewards() SECURITY DEFINER;
ALTER FUNCTION handle_order_status_update() SECURITY DEFINER;
ALTER FUNCTION set_city_from_address() SECURITY DEFINER;
ALTER FUNCTION set_default_coordinates() SECURITY DEFINER;
ALTER FUNCTION set_order_number() SECURITY DEFINER;
ALTER FUNCTION set_preparation_times() SECURITY DEFINER;
ALTER FUNCTION calculate_order_total() SECURITY DEFINER;
ALTER FUNCTION update_updated_at_column() SECURITY DEFINER;
