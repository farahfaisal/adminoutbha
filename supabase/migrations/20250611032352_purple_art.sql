/*
  # Add Advertisement Tracking Functions

  1. New Functions
    - `increment_advertisement_views` - Increments the view count for an advertisement
    - `increment_advertisement_clicks` - Increments the click count for an advertisement
  
  2. Security
    - Functions are accessible to both authenticated and anonymous users
    - Uses SECURITY DEFINER to ensure proper permissions
*/

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS increment_advertisement_views(uuid);
DROP FUNCTION IF EXISTS increment_advertisement_clicks(uuid);

-- Create function to increment advertisement views
CREATE OR REPLACE FUNCTION increment_advertisement_views(p_ad_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_ad_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Create function to increment advertisement clicks
CREATE OR REPLACE FUNCTION increment_advertisement_clicks(p_ad_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = p_ad_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_advertisement_views(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_advertisement_views(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_advertisement_clicks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_advertisement_clicks(uuid) TO anon;