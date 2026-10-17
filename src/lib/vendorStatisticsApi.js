import { supabase } from './supabase';

export async function getVendorStatistics(vendorId = null) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        id,
        vendor_id,
        vendor_name,
        total,
        subtotal,
        delivery_fee,
        status,
        payment_method,
        created_at
      `)
      .neq('status', 'cancelled');

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const vendorStats = {};

    orders.forEach(order => {
      const vid = order.vendor_id;
      if (!vid) return;

      if (!vendorStats[vid]) {
        vendorStats[vid] = {
          vendor_id: vid,
          vendor_name: order.vendor_name || 'غير معروف',
          total_sales: 0,
          total_orders: 0,
          vendor_earnings: 0,
          store_commission: 0,
          commission_rate: 0,
          orders_by_payment: {
            cash: 0,
            electronic: 0
          },
          sales_by_payment: {
            cash: 0,
            electronic: 0
          }
        };
      }

      const orderTotal = parseFloat(order.total) || 0;
      const subtotal = parseFloat(order.subtotal) || 0;

      vendorStats[vid].total_sales += orderTotal;
      vendorStats[vid].total_orders += 1;

      if (order.payment_method === 'cash') {
        vendorStats[vid].orders_by_payment.cash += 1;
        vendorStats[vid].sales_by_payment.cash += orderTotal;
      } else {
        vendorStats[vid].orders_by_payment.electronic += 1;
        vendorStats[vid].sales_by_payment.electronic += orderTotal;
      }
    });

    const vendorIds = Object.keys(vendorStats);
    if (vendorIds.length > 0) {
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, commission_rate, rating, rating_count')
        .in('id', vendorIds);

      if (vendorsError) throw vendorsError;

      vendors.forEach(vendor => {
        if (vendorStats[vendor.id]) {
          const commissionRate = parseFloat(vendor.commission_rate) || 10;
          vendorStats[vendor.id].commission_rate = commissionRate;

          const totalSales = vendorStats[vendor.id].total_sales;
          const storeCommission = (totalSales * commissionRate) / 100;
          const vendorEarnings = totalSales - storeCommission;

          vendorStats[vendor.id].store_commission = storeCommission;
          vendorStats[vendor.id].vendor_earnings = vendorEarnings;
          vendorStats[vendor.id].rating = parseFloat(vendor.rating) || 0;
          vendorStats[vendor.id].rating_count = vendor.rating_count || 0;
        }
      });
    }

    return Object.values(vendorStats);
  } catch (error) {
    console.error('Error fetching vendor statistics:', error);
    throw error;
  }
}

export async function getVendorDetailedStatistics(vendorId) {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        total,
        subtotal,
        delivery_fee,
        status,
        payment_method,
        created_at
      `)
      .eq('vendor_id', vendorId);

    if (error) throw error;

    const completedOrders = orders.filter(o => o.status === 'completed');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    const totalSales = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const cashSales = completedOrders
      .filter(o => o.payment_method === 'cash')
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const electronicSales = completedOrders
      .filter(o => o.payment_method !== 'cash')
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    const { data: vendor } = await supabase
      .from('vendors')
      .select('commission_rate, rating, rating_count, store_name')
      .eq('id', vendorId)
      .single();

    const commissionRate = parseFloat(vendor?.commission_rate) || 10;
    const storeCommission = (totalSales * commissionRate) / 100;
    const vendorEarnings = totalSales - storeCommission;

    const monthlySales = Array(12).fill(0);
    const monthlyOrders = Array(12).fill(0);

    completedOrders.forEach(order => {
      const month = new Date(order.created_at).getMonth();
      monthlySales[month] += parseFloat(order.total) || 0;
      monthlyOrders[month] += 1;
    });

    return {
      vendor_id: vendorId,
      vendor_name: vendor?.store_name || 'غير معروف',
      total_sales: totalSales,
      total_orders: completedOrders.length,
      pending_orders: pendingOrders.length,
      cancelled_orders: cancelledOrders.length,
      vendor_earnings: vendorEarnings,
      store_commission: storeCommission,
      commission_rate: commissionRate,
      cash_sales: cashSales,
      electronic_sales: electronicSales,
      rating: parseFloat(vendor?.rating) || 0,
      rating_count: vendor?.rating_count || 0,
      monthly_sales: monthlySales,
      monthly_orders: monthlyOrders,
      average_order_value: completedOrders.length > 0 ? totalSales / completedOrders.length : 0
    };
  } catch (error) {
    console.error('Error fetching vendor detailed statistics:', error);
    throw error;
  }
}
