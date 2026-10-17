import { supabase } from './supabase';

/**
 * تحديث موقع السائق
 * @param {string} driverId - معرف السائق
 * @param {number} latitude - خط العرض
 * @param {number} longitude - خط الطول
 * @returns {Promise<Object>} - نتيجة التحديث
 */
export const updateDriverLocation = async (driverId, latitude, longitude) => {
  try {
    const { data, error } = await supabase.rpc(
      'update_driver_location',
      {
        p_driver_id: driverId,
        p_latitude: latitude,
        p_longitude: longitude
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

/**
 * الحصول على السائقين القريبين من موقع معين
 * @param {number} latitude - خط العرض
 * @param {number} longitude - خط الطول
 * @param {number} radiusKm - نطاق البحث بالكيلومتر
 * @param {string} status - حالة السائق (اختياري)
 * @returns {Promise<Array>} - قائمة السائقين القريبين
 */
export const getNearbyDrivers = async (latitude, longitude, radiusKm = 10, status = null) => {
  try {
    const { data, error } = await supabase.rpc(
      'get_nearby_drivers',
      {
        p_latitude: latitude,
        p_longitude: longitude,
        p_radius_km: radiusKm,
        p_status: status
      }
    );
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching nearby drivers:', error);
    throw error;
  }
};

/**
 * الحصول على جميع السائقين مع مواقعهم
 * @returns {Promise<Array>} - قائمة السائقين مع المواقع
 */
export const getAllDriversWithLocation = async () => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        id,
        name,
        phone,
        status,
        rating,
        rating_count,
        latitude,
        longitude,
        last_location_update,
        vehicle_type,
        vehicle_model,
        vehicle_plate,
        working_areas
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('last_location_update', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching drivers with location:', error);
    throw error;
  }
};

/**
 * الحصول على الرحلات النشطة للسائق
 * @param {string} driverId - معرف السائق
 * @returns {Promise<Array>} - قائمة الرحلات النشطة
 */
export const getDriverActiveTrips = async (driverId) => {
  try {
    const { data, error } = await supabase
      .from('driver_trips')
      .select(`
        *,
        order:order_id(id, order_number, status, created_at)
      `)
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'in_progress'])
      .order('assigned_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching driver active trips:', error);
    throw error;
  }
};

/**
 * تحديث حالة السائق
 * @param {string} driverId - معرف السائق
 * @param {string} status - الحالة الجديدة
 * @returns {Promise<Object>} - نتيجة التحديث
 */
export const updateDriverStatus = async (driverId, status) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({ 
        status,
        last_location_update: new Date().toISOString()
      })
      .eq('id', driverId)
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating driver status:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات تتبع السائقين
 * @returns {Promise<Object>} - إحصائيات التتبع
 */
export const getDriverTrackingStats = async () => {
  try {
    const { data, error } = await supabase.rpc('get_drivers_tracking_stats');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching driver tracking stats:', error);
    throw error;
  }
};

/**
 * الحصول على مسار السائق (آخر المواقع)
 * @param {string} driverId - معرف السائق
 * @param {number} hours - عدد الساعات للبحث (افتراضي: 24)
 * @returns {Promise<Array>} - قائمة المواقع
 */
export const getDriverLocationHistory = async (driverId, hours = 24) => {
  try {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    // For now, we'll return the current location as history
    // In a real implementation, you'd have a location_history table
    const { data, error } = await supabase
      .from('drivers')
      .select('latitude, longitude, last_location_update')
      .eq('id', driverId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .single();
    
    if (error) throw error;
    
    return data ? [{
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.last_location_update || new Date().toISOString()
    }] : [];
  } catch (error) {
    console.error('Error fetching driver location history:', error);
    return [];
  }
};

/**
 * تحديث موقع السائق مع التحقق من الصلاحيات
 * @param {string} driverId - معرف السائق
 * @param {number} latitude - خط العرض
 * @param {number} longitude - خط الطول
 * @param {string} userId - معرف المستخدم (للتحقق من الصلاحيات)
 * @returns {Promise<Object>} - نتيجة التحديث
 */
export const updateDriverLocationSecure = async (driverId, latitude, longitude, userId) => {
  try {
    // التحقق من أن المستخدم هو السائق نفسه أو مدير
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('user_id')
      .eq('id', driverId)
      .single();
    
    if (driverError) throw driverError;
    
    // التحقق من الصلاحيات
    const { data: isAdmin, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (adminError && adminError.code !== 'PGRST116') throw adminError;
    
    if (driver.user_id !== userId && !isAdmin) {
      throw new Error('ليس لديك صلاحية لتحديث موقع هذا السائق');
    }
    
    // تحديث الموقع
    return await updateDriverLocation(driverId, latitude, longitude);
  } catch (error) {
    console.error('Error updating driver location securely:', error);
    throw error;
  }
};