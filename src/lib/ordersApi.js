import { supabase } from './supabase';
import { mapStatusToAllowedValue, mapToOrderStatusHistoryValue, getDefaultStatusNote } from '../utils/orderUtils';

/**
 * Check if a user exists in custom_users table
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - Whether user exists
 */
const checkUserExists = async (userId) => {
  try {
    // First validate that we have a userId
    if (!userId) {
      console.warn('No user ID provided to checkUserExists');
      return false;
    }

    const { data, error } = await supabase
      .from('custom_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single()
      
    if (error) {
      console.warn('Error checking user existence:', error);
      return false;
    }
    
    return !!data; // Will return false if data is null (no user found)
  } catch (error) {
    console.warn('Error checking user existence:', error);
    return false;
  }
};

/**
 * Update order status and add to history if possible
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {string} note - Status note
 * @returns {Promise<Object>} - Updated order
 */
export const updateOrderStatus = async (orderId, status, note = '') => {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // If no authenticated user, try to get from localStorage
    let userId = user?.id;
    if (!userId) {
      const localUser = JSON.parse(localStorage.getItem('userData') || '{}');
      userId = localUser.id;
    }

    // If still no user ID, throw an error
    if (!userId) {
      throw new Error('يجب تسجيل الدخول لتحديث حالة الطلب');
    }

    // Map the status to a valid database status for orders table
    const dbStatus = mapStatusToAllowedValue(status);

    // First update the order status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({ status: dbStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating order status:', orderError);
      throw new Error('فشل في تحديث حالة الطلب');
    }

    // Check if user exists in custom_users table
    const userExists = await checkUserExists(userId);
    
    if (!userExists) {
      console.warn('User does not exist in custom_users table, skipping status history');
      return orderData;
    }

    // Map the status to a valid database status for order_status_history table
    const historyStatus = mapToOrderStatusHistoryValue(status);

    // Then add the status history record with the user ID
    const { data: historyData, error: historyError } = await supabase
      .from('order_status_history')
      .insert([{
        order_id: orderId,
        status: historyStatus,
        note: note || getDefaultStatusNote(status),
        created_by: userId
      }])
      .select()
      .single();

    if (historyError) {
      console.warn('Error adding status history:', historyError);
      // Don't throw error, just log warning and continue
    }

    return orderData;
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    throw error;
  }
};

/**
 * الحصول على قائمة الطلبات
 * @param {Object} options - خيارات الفلترة
 * @returns {Promise<Array>} - قائمة الطلبات
 */
const getOrders = async (options = {}) => {
  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customer_id(*),
        vendor:vendor_id(*),
        driver:driver_id(*)
      `);
    
    // تطبيق الفلاتر
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.vendorId) {
      query = query.eq('vendor_id', options.vendorId);
    }
    
    if (options.driverId) {
      query = query.eq('driver_id', options.driverId);
    }
    
    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    
    if (options.startDate && options.endDate) {
      query = query.gte('created_at', options.startDate).lte('created_at', options.endDate);
    }
    
    // ترتيب النتائج
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // جلب عناصر الطلب لكل طلب
    const ordersWithItems = await Promise.all(
      data.map(async (order) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            *,
            product:product_id(*)
          `)
          .eq('order_id', order.id);
        
        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
          return { ...order, items: [] };
        }
        
        return { ...order, items: itemsData || [] };
      })
    );
    
    return ordersWithItems;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

/**
 * الحصول على طلب محدد
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<Object>} - بيانات الطلب
 */
const getOrder = async (orderId) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customer_id(*),
        vendor:vendor_id(*),
        driver:driver_id(*)
      `)
      .eq('id', orderId)
      .single();
    
    if (error) throw error;
    
    // جلب عناصر الطلب
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        product:product_id(*)
      `)
      .eq('order_id', orderId);
    
    if (itemsError) throw itemsError;
    
    return { ...data, items: itemsData || [] };
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

/**
 * تعيين سائق للطلب
 * @param {string} orderId - معرف الطلب
 * @param {string} driverId - معرف السائق
 * @returns {Promise<Object>} - الطلب المحدث
 */
const assignDriverToOrder = async (orderId, driverId) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        driver_id: driverId,
        status: 'delivering'
      })
      .eq('id', orderId)
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error assigning driver:', error);
    throw error;
  }
};

/**
 * إضافة الطلب لقائمة انتظار السائقين
 * @param {string} orderId - معرف الطلب
 * @param {string} vendorId - معرف البائع
 * @param {Object} orderDetails - تفاصيل الطلب الإضافية
 * @returns {Promise<Object>} - بيانات قائمة الانتظار
 */
export const addOrderToWaitingList = async (orderId, vendorId, orderDetails = {}) => {
  try {
    // التحقق من وجود معرف الطلب والبائع
    if (!orderId || !vendorId) {
      throw new Error('معرف الطلب أو البائع غير متوفر');
    }

    // إضافة الطلب إلى قائمة الانتظار
    const { data, error } = await supabase
      .from('driver_waiting_list')
      .insert([{
        order_id: orderId,
        vendor_id: vendorId,
        status: 'pending',
        customer_name: orderDetails.customer_name || '',
        address: orderDetails.address || '',
        total: orderDetails.total || 0,
        notes: orderDetails.notes || ''
      }])
      .select();
    
    if (error) throw error;
    
    // تحديث حالة الطلب
    await updateOrderStatus(orderId, 'waiting-for-driver', 'تم إضافة الطلب لقائمة انتظار السائقين');
    
    return data[0];
  } catch (error) {
    console.error('Error adding order to waiting list:', error);
    throw error;
  }
};

/**
 * تغيير سائق الطلب
 * @param {string} orderId - معرف الطلب
 * @param {string} driverId - معرف السائق الجديد
 * @param {string} note - ملاحظة حول التغيير
 * @returns {Promise<Object>} - الطلب المحدث
 */
export const changeOrderDriver = async (orderId, driverId, note = '') => {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // If no authenticated user, try to get from localStorage
    let userId = user?.id;
    if (!userId) {
      const localUser = JSON.parse(localStorage.getItem('userData') || '{}');
      userId = localUser.id;
    }

    // If still no user ID, throw an error
    if (!userId) {
      throw new Error('يجب تسجيل الدخول لتغيير السائق');
    }

    // Try to assign trip to driver
    try {
      const { data: tripData, error: tripError } = await supabase.rpc(
        'assign_trip_to_driver',
        { 
          p_order_id: orderId,
          p_driver_id: driverId
        }
      );
      
      if (!tripError) {
        // Trip was successfully assigned
        return { id: orderId, driver_id: driverId };
      }
    } catch (tripError) {
      console.warn('Could not assign trip directly, falling back to regular driver change:', tripError);
    }

    // Update the order with the new driver
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        driver_id: driverId,
        driver_name: (await supabase.from('drivers').select('name').eq('id', driverId).single()).data?.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select();
    
    if (error) throw error;
    
    // Add a history record for the driver change
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert([{
        order_id: orderId,
        status: data[0].status,
        note: note || 'تم تغيير السائق',
        created_by: userId
      }]);
    
    if (historyError) {
      console.error('Error adding status history:', historyError);
      throw new Error('فشل في إضافة سجل تغيير السائق');
    }
    
    return data[0];
  } catch (error) {
    console.error('Error changing order driver:', error);
    throw error;
  }
};

/**
 * الحصول على سجل حالات الطلب
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<Array>} - سجل الحالات
 */
export const getOrderStatusHistory = async (orderId) => {
  try {
    // Query the order status history using the correct RPC function name
    const { data, error } = await supabase.rpc(
      'get_order_status_history',
      { p_order_id: orderId }
    );
    
    if (error) {
      console.error('Error fetching status history via RPC:', error);
      
      // Fallback to direct query
      const { data: directData, error: directError } = await supabase
      .from('order_status_history')
      .select(`
        *,
        user:created_by(*)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
      
      if (directError) {
        console.error('Error fetching status history directly:', directError);
        return [];
      }
      
      return directData || [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching order status history:', error);
    return [];
  }
};

/**
 * الحصول على قائمة الطلبات في انتظار السائقين
 * @param {string} vendorId - معرف البائع (اختياري)
 * @param {string} status - حالة الطلبات (اختياري، الافتراضي: 'pending')
 * @returns {Promise<Array>} - قائمة الطلبات
 */
export const getWaitingListOrders = async (vendorId = null, status = 'pending') => {
  try {
    let query = supabase
      .from('driver_waiting_list')
      .select(`
        *,
        order:order_id(*),
        vendor:vendor_id(store_name),
        driver:driver_id(name, phone)
      `);
    
    // تطبيق الفلاتر
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // ترتيب النتائج
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching waiting list orders:', error);
    throw error;
  }
};

/**
 * تعيين سائق لطلب في قائمة الانتظار
 * @param {string} waitingListId - معرف الطلب في قائمة الانتظار
 * @param {string} driverId - معرف السائق
 * @returns {Promise<Object>} - بيانات قائمة الانتظار المحدثة
 */
export const assignDriverToWaitingList = async (waitingListId, driverId) => {
  try {
    // الحصول على اسم السائق
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('name')
      .eq('id', driverId)
      .single();
    
    if (driverError) throw driverError;
    
    // تحديث قائمة الانتظار
    const { data, error } = await supabase
      .from('driver_waiting_list')
      .update({
        driver_id: driverId,
        driver_name: driverData.name,
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', waitingListId)
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error assigning driver to waiting list:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات الطلبات
 * @returns {Promise<Object>} - إحصائيات الطلبات
 */
const getOrdersStats = async () => {
  try {
    // إجمالي الطلبات
    const { count: totalOrders, error: totalError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // الطلبات حسب الحالة
    const statuses = ['pending', 'accepted', 'processing', 'ready', 'delivering', 'completed', 'rejected', 'cancelled'];
    const statusCounts = {};
    
    for (const status of statuses) {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      
      if (error) throw error;
      statusCounts[status] = count;
    }
    
    // الطلبات حسب طريقة الدفع
    const paymentMethods = ['cash', 'electronic', 'wallet'];
    const paymentCounts = {};
    
    for (const method of paymentMethods) {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('payment_method', method);
      
      if (error) throw error;
      paymentCounts[method] = count;
    }
    
    // إجمالي المبيعات
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total');
    
    if (salesError) throw salesError;
    
    const totalSales = salesData.reduce((sum, order) => sum + parseFloat(order.total), 0);
    
    return {
      totalOrders,
      statusCounts,
      paymentCounts,
      totalSales
    };
  } catch (error) {
    console.error('Error fetching orders stats:', error);
    throw error;
  }
};