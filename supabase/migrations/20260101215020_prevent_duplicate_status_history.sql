/*
  # Prevent Duplicate Status History Records

  1. Changes
    - Add function to prevent duplicate status history records
    - Create trigger to check for duplicates before insert

  2. Purpose
    - Prevents the same status from being added multiple times within a short time period
    - Helps avoid duplicate entries when multiple systems update the same order

  3. Implementation
    - Checks if a status was added in the last 3 seconds for the same order
    - Only blocks exact duplicate status with same order_id
*/

-- Create function to prevent duplicate status history within 3 seconds
CREATE OR REPLACE FUNCTION prevent_duplicate_status_history()
RETURNS TRIGGER AS $$
DECLARE
  recent_status_count INTEGER;
BEGIN
  -- Check if the same status was added in the last 3 seconds for this order
  SELECT COUNT(*) INTO recent_status_count
  FROM order_status_history
  WHERE order_id = NEW.order_id
    AND status = NEW.status
    AND created_at > (NOW() - INTERVAL '3 seconds');

  -- If a recent duplicate exists, skip the insert
  IF recent_status_count > 0 THEN
    RAISE NOTICE 'Skipping duplicate status history entry for order % with status %', NEW.order_id, NEW.status;
    RETURN NULL;  -- This prevents the insert
  END IF;

  -- Allow the insert
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS check_duplicate_status_history ON order_status_history;

-- Create trigger to check for duplicates before insert
CREATE TRIGGER check_duplicate_status_history
  BEFORE INSERT ON order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_status_history();