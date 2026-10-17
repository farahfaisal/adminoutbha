/*
  # إضافة سياسات notification_settings للمديرين

  ## التغييرات
  
  1. إضافة سياسات جديدة لـ notification_settings
    - السماح للمديرين بقراءة وتعديل الإعدادات العامة
    - إنشاء صف إعدادات افتراضي إذا لم يكن موجوداً
  
  2. إضافة دالة للحصول على إعدادات الإشعارات أو إنشائها
  
  ## الأمان
  - الحفاظ على RLS مفعل
  - السماح بالوصول للمديرين فقط
*/

-- حذف السياسات القديمة إذا كانت موجودة
DO $$
BEGIN
  -- حذف سياسة عرض الإعدادات للمديرين
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Admins can view all notification settings'
  ) THEN
    DROP POLICY "Admins can view all notification settings" ON notification_settings;
  END IF;
  
  -- حذف سياسة إنشاء الإعدادات للمديرين
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Admins can insert notification settings'
  ) THEN
    DROP POLICY "Admins can insert notification settings" ON notification_settings;
  END IF;
  
  -- حذف سياسة تحديث الإعدادات للمديرين
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Admins can update all notification settings'
  ) THEN
    DROP POLICY "Admins can update all notification settings" ON notification_settings;
  END IF;
END
$$;

-- إضافة سياسات للمديرين لعرض جميع إعدادات الإشعارات
CREATE POLICY "Admins can view all notification settings"
  ON notification_settings
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  );

-- إضافة سياسات للمديرين لإنشاء إعدادات الإشعارات
CREATE POLICY "Admins can insert notification settings"
  ON notification_settings
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  );

-- إضافة سياسات للمديرين لتحديث إعدادات الإشعارات
CREATE POLICY "Admins can update all notification settings"
  ON notification_settings
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
      AND super_admins.status = 'active'
    )
  );

-- إنشاء دالة للحصول على إعدادات الإشعارات أو إنشائها
CREATE OR REPLACE FUNCTION get_or_create_notification_settings()
RETURNS notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings notification_settings;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- إذا لم يكن هناك مستخدم مصادق، إرجاع إعدادات افتراضية
  IF v_user_id IS NULL THEN
    -- البحث عن أي إعدادات موجودة (للأنظمة القديمة)
    SELECT * INTO v_settings
    FROM notification_settings
    LIMIT 1;
    
    -- إذا لم توجد، إرجاع إعدادات افتراضية
    IF NOT FOUND THEN
      -- إنشاء صف افتراضي مؤقت (لا يتم حفظه)
      v_settings.id := gen_random_uuid();
      v_settings.user_id := NULL;
      v_settings.sound_enabled := true;
      v_settings.continuous_sound_enabled := true;
      v_settings.browser_notifications_enabled := true;
      v_settings.push_notifications_enabled := true;
      v_settings.email_notifications_enabled := false;
      v_settings.sms_notifications_enabled := false;
      v_settings.auto_notifications_enabled := true;
      v_settings.created_at := now();
      v_settings.updated_at := now();
    END IF;
    
    RETURN v_settings;
  END IF;
  
  -- محاولة الحصول على إعدادات المستخدم الحالي
  SELECT * INTO v_settings
  FROM notification_settings
  WHERE user_id = v_user_id;
  
  -- إذا لم توجد، إنشاء إعدادات جديدة
  IF NOT FOUND THEN
    INSERT INTO notification_settings (
      user_id,
      sound_enabled,
      continuous_sound_enabled,
      browser_notifications_enabled,
      push_notifications_enabled,
      email_notifications_enabled,
      sms_notifications_enabled,
      auto_notifications_enabled
    ) VALUES (
      v_user_id,
      true,
      true,
      true,
      true,
      false,
      false,
      true
    )
    RETURNING * INTO v_settings;
  END IF;
  
  RETURN v_settings;
END;
$$;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION get_or_create_notification_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_notification_settings() TO anon;