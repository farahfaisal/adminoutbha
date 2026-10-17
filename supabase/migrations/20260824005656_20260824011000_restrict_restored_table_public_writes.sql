/*
# Restrict public writes on restored application tables

1. Purpose
- Keep the restored application tables readable by the public client so screens can display their data.
- Remove inherited anonymous INSERT, UPDATE, and DELETE privileges that could allow unauthenticated data changes.

2. Modified objects
- Revokes anonymous write privileges from all tables restored in the previous migration.
- Removes any anonymous write policies on those tables and keeps authenticated CRUD policies.

3. Security
- Anonymous and authenticated users retain SELECT access.
- Only authenticated database sessions can insert, update, or delete rows.
- No data is deleted or changed by this migration.

4. Important notes
- The public password-verification RPC remains executable because the login screen must call it before a session exists.
- The existing legacy tables are not changed in this focused hardening migration.
*/

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'custom_users','profiles','user_sessions','login_attempts','audit_logs','api_keys','api_devices','app_devices','vendor_app_sessions','super_admins',
    'product_catalogs','catalog_items','vendor_categories','vendor_categories_table','vendor_to_category','media_files','slider_advertisements',
    'drivers','driver_trips','driver_waiting_list','captain_orders','order_status_history','captain_order_status_history','parcel_order_status_history','driver_wallets','driver_settlements',
    'vendor_drivers','vendor_wallets','vendor_settlements','service_area_managers','service_area_manager_assignments',
    'wallets','wallet_transactions','payment_methods','payment_methods_config','wholesale_tiers','customer_wholesale_tiers',
    'notification_settings','notification_logs','payment_notifications'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', table_name);
    EXECUTE format('DROP POLICY IF EXISTS insert_%I ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS update_%I ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS delete_%I ON public.%I', table_name, table_name);
  END LOOP;
END $$;
