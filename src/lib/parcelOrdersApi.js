import { supabase } from './supabase';

export const parcelOrdersApi = {
  async getAll(filters = {}) {
    try {
      let query = supabase
        .from('parcel_orders')
        .select(`
          *,
          driver:drivers(id, name, phone),
          service_area:service_areas(id, name, city)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.driver_id) {
        query = query.eq('driver_id', filters.driver_id);
      }

      if (filters.service_area_id) {
        query = query.eq('service_area_id', filters.service_area_id);
      }

      if (filters.payment_method && filters.payment_method !== 'all') {
        query = query.eq('payment_method', filters.payment_method);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.search) {
        query = query.or(
          `order_number.ilike.%${filters.search}%,` +
          `sender_name.ilike.%${filters.search}%,` +
          `sender_phone.ilike.%${filters.search}%,` +
          `receiver_name.ilike.%${filters.search}%,` +
          `receiver_phone.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching parcel orders:', error);
      return { data: null, error };
    }
  },

  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('parcel_orders')
        .select(`
          *,
          driver:drivers(id, name, phone, email, rating),
          service_area:service_areas(id, name, city)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching parcel order:', error);
      return { data: null, error };
    }
  },

  async create(orderData) {
    try {
      const { data, error } = await supabase
        .from('parcel_orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating parcel order:', error);
      return { data: null, error };
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('parcel_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating parcel order:', error);
      return { data: null, error };
    }
  },

  async updateStatus(id, status, additionalData = {}) {
    try {
      const updates = { status, ...additionalData };

      if (status === 'accepted') {
        updates.accepted_at = new Date().toISOString();
      } else if (status === 'picked_up') {
        updates.picked_up_at = new Date().toISOString();
      } else if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();
        updates.actual_delivery_time = new Date().toISOString();
      } else if (status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('parcel_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating parcel order status:', error);
      return { data: null, error };
    }
  },

  async assignDriver(id, driverId) {
    try {
      const { data, error } = await supabase
        .from('parcel_orders')
        .update({ driver_id: driverId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error assigning driver:', error);
      return { data: null, error };
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from('parcel_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting parcel order:', error);
      return { error };
    }
  },

  async addToWaitingList(orderId) {
    try {
      const { data: order, error: orderError } = await supabase
        .from('parcel_orders')
        .select('id, delivery_fee, sender_latitude, sender_longitude')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) {
        console.error('Order fetch error:', orderError);
        throw orderError;
      }

      if (!order) {
        throw new Error('Parcel order not found');
      }

      const { data: existingEntry, error: checkError } = await supabase
        .from('driver_waiting_list')
        .select('id')
        .eq('parcel_order_id', orderId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Check existing entry error:', checkError);
        throw checkError;
      }

      if (existingEntry) {
        return { data: existingEntry, error: null };
      }

      const insertData = {
        parcel_order_id: orderId,
        vendor_id: null,
        total: order.delivery_fee || 0,
        status: 'pending',
        geocoded_latitude: order.sender_latitude || null,
        geocoded_longitude: order.sender_longitude || null,
        created_at: new Date().toISOString()
      };

      console.log('Inserting to driver_waiting_list:', insertData);

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
      console.error('Error adding parcel order to waiting list:', error);
      return { data: null, error };
    }
  },

  async removeFromWaitingList(orderId) {
    try {
      const { error } = await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('parcel_order_id', orderId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error removing parcel order from waiting list:', error);
      return { error };
    }
  },

  async getStatistics(filters = {}) {
    try {
      let query = supabase
        .from('parcel_orders')
        .select('id, status, delivery_fee, payment_status, created_at');

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      const statistics = {
        total: data.length,
        pending: data.filter(o => o.status === 'pending').length,
        accepted: data.filter(o => o.status === 'accepted').length,
        in_transit: data.filter(o => o.status === 'in_transit').length,
        delivered: data.filter(o => o.status === 'delivered').length,
        cancelled: data.filter(o => o.status === 'cancelled').length,
        total_revenue: data
          .filter(o => o.payment_status === 'paid')
          .reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0),
        pending_payment: data
          .filter(o => o.payment_status === 'pending')
          .reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0)
      };

      return { data: statistics, error: null };
    } catch (error) {
      console.error('Error fetching parcel orders statistics:', error);
      return { data: null, error };
    }
  }
};
