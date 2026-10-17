-- Create notification_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  sound_enabled boolean DEFAULT true,
  continuous_sound_enabled boolean DEFAULT true,
  browser_notifications_enabled boolean DEFAULT true,
  push_notifications_enabled boolean DEFAULT true,
  email_notifications_enabled boolean DEFAULT false,
  sms_notifications_enabled boolean DEFAULT false,
  auto_notifications_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users
);

-- Enable RLS on notification_settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on order_notifications
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  -- Drop policies for notification_settings if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Users can view their own notification settings'
  ) THEN
    DROP POLICY "Users can view their own notification settings" ON notification_settings;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Users can insert their own notification settings'
  ) THEN
    DROP POLICY "Users can insert their own notification settings" ON notification_settings;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Users can update their own notification settings'
  ) THEN
    DROP POLICY "Users can update their own notification settings" ON notification_settings;
  END IF;
  
  -- Drop policies for order_notifications if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_notifications' AND policyname = 'Vendors can view their order notifications'
  ) THEN
    DROP POLICY "Vendors can view their order notifications" ON order_notifications;
  END IF;
END
$$;

-- Create policies for notification_settings
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings
  FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings
  FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policies for order_notifications
CREATE POLICY "Vendors can view their order notifications"
  ON order_notifications
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_notifications.order_id
    AND orders.vendor_id IN (
      SELECT vendors.id FROM vendors
      WHERE vendors.user_id = auth.uid()
    )
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_order_id ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_created_at ON order_notifications(created_at);

-- Drop view if it exists to avoid errors
DROP VIEW IF EXISTS notification_preferences;

-- Create view for notification preferences
CREATE OR REPLACE VIEW notification_preferences AS
SELECT 
  user_id,
  sound_enabled,
  continuous_sound_enabled,
  browser_notifications_enabled,
  push_notifications_enabled,
  auto_notifications_enabled
FROM notification_settings;

-- Create function to create default notification settings for new users
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
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
    NEW.id,
    true,
    true,
    true,
    true,
    false,
    false,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS create_notification_settings_for_new_user ON auth.users;

-- Create trigger to create default notification settings for new users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_notification_settings_for_new_user'
  ) THEN
    CREATE TRIGGER create_notification_settings_for_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_settings();
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- If auth.users doesn't exist or we don't have access to it, just skip this part
    RAISE NOTICE 'Could not create trigger on auth.users table';
END
$$;

-- Drop function if it exists
DROP FUNCTION IF EXISTS add_order_notification(UUID, TEXT, UUID);

-- Create function to add notification
CREATE OR REPLACE FUNCTION add_order_notification(
  p_order_id UUID,
  p_message TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO order_notifications (
    order_id,
    message,
    is_read,
    created_by
  ) VALUES (
    p_order_id,
    p_message,
    false,
    p_created_by
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_order_notification(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_order_notification(UUID, TEXT, UUID) TO anon;