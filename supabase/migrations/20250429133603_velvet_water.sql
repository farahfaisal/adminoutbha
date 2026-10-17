/*
  # إضافة دعم تقييمات البائعين

  1. التغييرات
    - إضافة دالة للحصول على تقييمات البائع
    - إضافة دالة لحساب إحصائيات التقييمات
*/

-- إنشاء دالة للحصول على تقييمات البائع
CREATE OR REPLACE FUNCTION get_vendor_ratings(p_vendor_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  from_type text,
  from_id uuid,
  from_name text,
  rating int,
  comment text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.order_id,
    r.from_type,
    r.from_id,
    CASE 
      WHEN r.from_type = 'customer' THEN c.name
      WHEN r.from_type = 'driver' THEN d.name
      ELSE 'غير معروف'
    END as from_name,
    r.rating,
    r.comment,
    r.created_at
  FROM ratings r
  LEFT JOIN customers c ON r.from_type = 'customer' AND r.from_id = c.id
  LEFT JOIN drivers d ON r.from_type = 'driver' AND r.from_id = d.id
  WHERE r.to_type = 'vendor'
  AND r.to_id = p_vendor_id
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة لحساب إحصائيات تقييمات البائع
CREATE OR REPLACE FUNCTION get_vendor_rating_stats(p_vendor_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_avg_rating decimal(3,2);
  v_total int;
  v_distribution jsonb;
  v_result jsonb;
BEGIN
  -- حساب متوسط التقييم وعدد التقييمات
  SELECT 
    COALESCE(AVG(rating), 0)::decimal(3,2),
    COUNT(*)
  INTO v_avg_rating, v_total
  FROM ratings
  WHERE to_type = 'vendor'
  AND to_id = p_vendor_id;
  
  -- حساب توزيع التقييمات
  SELECT jsonb_build_object(
    '5', COUNT(*) FILTER (WHERE rating = 5),
    '4', COUNT(*) FILTER (WHERE rating = 4),
    '3', COUNT(*) FILTER (WHERE rating = 3),
    '2', COUNT(*) FILTER (WHERE rating = 2),
    '1', COUNT(*) FILTER (WHERE rating = 1)
  ) INTO v_distribution
  FROM ratings
  WHERE to_type = 'vendor'
  AND to_id = p_vendor_id;
  
  -- بناء النتيجة
  v_result := jsonb_build_object(
    'average', v_avg_rating,
    'total', v_total,
    'distribution', v_distribution
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء دالة للحصول على آخر التقييمات للبائع
CREATE OR REPLACE FUNCTION get_latest_vendor_ratings(p_vendor_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  from_type text,
  from_id uuid,
  from_name text,
  rating int,
  comment text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.order_id,
    r.from_type,
    r.from_id,
    CASE 
      WHEN r.from_type = 'customer' THEN c.name
      WHEN r.from_type = 'driver' THEN d.name
      ELSE 'غير معروف'
    END as from_name,
    r.rating,
    r.comment,
    r.created_at
  FROM ratings r
  LEFT JOIN customers c ON r.from_type = 'customer' AND r.from_id = c.id
  LEFT JOIN drivers d ON r.from_type = 'driver' AND r.from_id = d.id
  WHERE r.to_type = 'vendor'
  AND r.to_id = p_vendor_id
  ORDER BY r.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;