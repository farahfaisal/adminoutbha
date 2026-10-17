import { supabase } from './supabase';

export const getCaptainOrders = async (filters = {}) => {
  try {
    let query = supabase
      .from('captain_orders')
      .select(`
        *,
        vendor:vendors(id, store_name, phone, address),
        driver:drivers(id, name, phone, vehicle_type, vehicle_plate)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.vendorId) {
      query = query.eq('vendor_id', filters.vendorId);
    }

    if (filters.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }

    if (filters.serviceAreaId) {
      query = query.eq('service_area_id', filters.serviceAreaId);
    }

    if (filters.search) {
      query = query.or(`order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching captain orders:', error);
    throw error;
  }
};

export const getCaptainOrderById = async (orderId) => {
  try {
    const { data, error } = await supabase
      .from('captain_orders')
      .select(`
        *,
        vendor:vendors(id, store_name, phone, address),
        driver:drivers(id, name, phone, vehicle_type, vehicle_plate)
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching captain order:', error);
    throw error;
  }
};

export const createCaptainOrder = async (orderData) => {
  try {
    const { data, error } = await supabase
      .from('captain_orders')
      .insert([orderData])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating captain order:', error);
    throw error;
  }
};

export const updateCaptainOrder = async (orderId, updates) => {
  try {
    const { data, error } = await supabase
      .from('captain_orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating captain order:', error);
    throw error;
  }
};

export const updateCaptainOrderStatus = async (orderId, status, timestamps = {}) => {
  try {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    if (timestamps.accepted_at) updates.accepted_at = timestamps.accepted_at;
    if (timestamps.picked_up_at) updates.picked_up_at = timestamps.picked_up_at;
    if (timestamps.delivered_at) updates.delivered_at = timestamps.delivered_at;

    const { data, error } = await supabase
      .from('captain_orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating captain order status:', error);
    throw error;
  }
};

export const assignDriverToCaptainOrder = async (orderId, driverId) => {
  try {
    const { data, error } = await supabase
      .from('captain_orders')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error assigning driver to captain order:', error);
    throw error;
  }
};

export const deleteCaptainOrder = async (orderId) => {
  try {
    const { error } = await supabase
      .from('captain_orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting captain order:', error);
    throw error;
  }
};

export const getCaptainOrderStatistics = async (filters = {}) => {
  try {
    let query = supabase
      .from('captain_orders')
      .select('status, delivery_fee');

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter(o => o.status === 'pending').length,
      accepted: data.filter(o => o.status === 'accepted').length,
      picked_up: data.filter(o => o.status === 'picked_up').length,
      delivered: data.filter(o => o.status === 'delivered').length,
      cancelled: data.filter(o => o.status === 'cancelled').length,
      totalDeliveryFees: data.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0)
    };

    return stats;
  } catch (error) {
    console.error('Error fetching captain order statistics:', error);
    throw error;
  }
};

export const addCaptainOrderToWaitingList = async (orderId) => {
  try {
    const { data: order, error: orderError } = await supabase
      .from('captain_orders')
      .select('id, delivery_fee, vendor_id, vendor:vendors(latitude, longitude)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('Order fetch error:', orderError);
      throw orderError;
    }

    if (!order) {
      throw new Error('Captain order not found');
    }

    const { data: existingEntry, error: checkError } = await supabase
      .from('driver_waiting_list')
      .select('id')
      .eq('captain_order_id', orderId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Check existing entry error:', checkError);
      throw checkError;
    }

    if (existingEntry) {
      return { data: existingEntry, error: null };
    }

    const insertData = {
      captain_order_id: orderId,
      vendor_id: order.vendor_id || null,
      total: order.delivery_fee || 0,
      status: 'pending',
      geocoded_latitude: order.vendor?.latitude || null,
      geocoded_longitude: order.vendor?.longitude || null,
      created_at: new Date().toISOString()
    };

    console.log('Inserting captain order to driver_waiting_list:', insertData);

    const { data, error } = await supabase
      .from('driver_waiting_list')
      .insert([insertData])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error adding captain order to waiting list:', error);
    return { data: null, error };
  }
};

export const removeCaptainOrderFromWaitingList = async (orderId) => {
  try {
    const { error } = await supabase
      .from('driver_waiting_list')
      .delete()
      .eq('captain_order_id', orderId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error removing captain order from waiting list:', error);
    return { error };
  }
};
