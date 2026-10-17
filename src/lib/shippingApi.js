import { supabase } from './supabase';

/**
 * Get shipping zones for a vendor
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<Array>} - List of shipping zones
 */
export const getVendorShippingZones = async (vendorId) => {
  try {
    const { data, error } = await supabase.rpc(
      'get_vendor_delivery_zones',
      { p_vendor_id: vendorId }
    );
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor shipping zones:', error);
    throw error;
  }
};

/**
 * Update vendor shipping zones
 * @param {string} vendorId - Vendor ID
 * @param {Array} zones - List of zones with prices
 * @returns {Promise<boolean>} - Success status
 */
export const updateVendorShippingZones = async (vendorId, zones) => {
  try {
    const { data, error } = await supabase.rpc(
      'update_vendor_delivery_zones',
      { 
        p_vendor_id: vendorId,
        p_zones: zones 
      }
    );
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating vendor shipping zones:', error);
    throw error;
  }
};

/**
 * Calculate delivery fee for a zone
 * @param {string} vendorId - Vendor ID
 * @param {string} zoneName - Zone name
 * @returns {Promise<number>} - Delivery fee
 */
export const calculateZoneDeliveryFee = async (vendorId, zoneName) => {
  try {
    const { data, error } = await supabase.rpc(
      'calculate_zone_delivery_fee',
      { 
        p_vendor_id: vendorId,
        p_zone_name: zoneName 
      }
    );
    
    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Error calculating zone delivery fee:', error);
    throw error;
  }
};

/**
 * Get all shipping zones
 * @returns {Promise<Array>} - List of all shipping zones
 */
export const getAllShippingZones = async () => {
  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching shipping zones:', error);
    throw error;
  }
};

/**
 * Create a new shipping zone
 * @param {Object} zoneData - Zone data
 * @returns {Promise<Object>} - Created zone
 */
export const createShippingZone = async (zoneData) => {
  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .insert([zoneData])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error creating shipping zone:', error);
    throw error;
  }
};

/**
 * Update a shipping zone
 * @param {string} zoneId - Zone ID
 * @param {Object} zoneData - Zone data
 * @returns {Promise<Object>} - Updated zone
 */
export const updateShippingZone = async (zoneId, zoneData) => {
  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .update(zoneData)
      .eq('id', zoneId)
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating shipping zone:', error);
    throw error;
  }
};

/**
 * Delete a shipping zone
 * @param {string} zoneId - Zone ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteShippingZone = async (zoneId) => {
  try {
    const { error } = await supabase
      .from('shipping_zones')
      .delete()
      .eq('id', zoneId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting shipping zone:', error);
    throw error;
  }
};

/**
 * Calculate delivery fee with offers applied
 * @param {string} vendorId - Vendor ID
 * @param {number} latitude - Customer latitude
 * @param {number} longitude - Customer longitude
 * @param {number} subtotal - Order subtotal
 * @returns {Promise<Object>} - Delivery calculation result with offers
 */
export const calculateDeliveryFeeWithOffers = async (vendorId, latitude, longitude, subtotal) => {
  try {
    const { data, error } = await supabase.rpc(
      'calculate_delivery_fee_with_offers',
      {
        p_vendor_id: vendorId,
        p_customer_lat: latitude,
        p_customer_lng: longitude,
        p_subtotal: subtotal
      }
    );

    if (error) throw error;
    return data || {
      delivery_fee: 0,
      discount: 0,
      final_delivery_fee: 0,
      offer_applied: false,
      offer_id: null,
      offer_title: null
    };
  } catch (error) {
    console.error('Error calculating delivery fee with offers:', error);
    throw error;
  }
};

/**
 * Apply delivery offer
 * @param {string} vendorId - Vendor ID
 * @param {number} subtotal - Order subtotal
 * @param {number} deliveryFee - Base delivery fee
 * @returns {Promise<Object>} - Offer application result
 */
export const applyDeliveryOffer = async (vendorId, subtotal, deliveryFee) => {
  try {
    const { data, error } = await supabase.rpc(
      'apply_delivery_offer',
      {
        p_vendor_id: vendorId,
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee
      }
    );

    if (error) throw error;
    return data || {
      delivery_fee: deliveryFee,
      discount: 0,
      final_delivery_fee: deliveryFee,
      offer_applied: false,
      offer_id: null,
      offer_title: null
    };
  } catch (error) {
    console.error('Error applying delivery offer:', error);
    throw error;
  }
};