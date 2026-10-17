import { supabase } from './supabase';

/**
 * Authenticate a driver with username and password
 * @param {string} username - Driver's username
 * @param {string} password - Driver's password
 * @returns {Promise<Object>} - Login result with driver data if successful
 */
export const loginDriver = async (username, password) => {
  try {
    // For demo purposes, allow any login
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('phone', username)
      .single();
    
    if (error) {
      throw new Error('Invalid username or password');
    }
    
    // Store driver data in localStorage
    localStorage.setItem('driverData', JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Error logging in driver:', error);
    throw error;
  }
};

/**
 * Check if a driver is currently logged in
 * @returns {boolean} - Whether a driver is logged in
 */
export const isDriverLoggedIn = () => {
  try {
    const driverData = localStorage.getItem('driverData');
    return !!driverData;
  } catch (error) {
    return false;
  }
};

/**
 * Get the currently logged in driver's data
 * @returns {Object|null} - Driver data or null if not logged in
 */
export const getCurrentDriver = () => {
  try {
    const driverData = localStorage.getItem('driverData');
    return driverData ? JSON.parse(driverData) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Log out the current driver
 * @returns {Promise<void>}
 */
export const logoutDriver = async () => {
  localStorage.removeItem('driverData');
};

/**
 * Update driver status (available, busy, offline)
 * @param {string} driverId - Driver ID
 * @param {string} status - New status
 * @returns {Promise<Object>} - Updated driver data
 */
export const updateDriverStatus = async (driverId, status) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driverId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Update local storage
    const driverData = getCurrentDriver();
    if (driverData && driverData.id === driverId) {
      localStorage.setItem('driverData', JSON.stringify({
        ...driverData,
        status
      }));
    }
    
    return data;
  } catch (error) {
    console.error('Error updating driver status:', error);
    throw error;
  }
};

/**
 * Update driver location
 * @param {string} driverId - Driver ID
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object>} - Updated driver data
 */
export const updateDriverLocation = async (driverId, latitude, longitude) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({ 
        latitude, 
        longitude,
        last_location_update: new Date().toISOString()
      })
      .eq('id', driverId)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};