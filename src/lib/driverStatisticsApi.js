import { supabase } from './supabase';

export async function getDriverStatistics(driverId = null, filters = {}) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        id,
        driver_id,
        driver_name,
        total,
        delivery_fee,
        status,
        payment_method,
        created_at
      `)
      .neq('status', 'cancelled')
      .not('driver_id', 'is', null);

    if (driverId) {
      query = query.eq('driver_id', driverId);
    }

    if (filters.month && filters.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      query = query.gte('created_at', startDate.toISOString())
                   .lte('created_at', endDate.toISOString());
    } else if (filters.year) {
      const startDate = new Date(filters.year, 0, 1);
      const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
      query = query.gte('created_at', startDate.toISOString())
                   .lte('created_at', endDate.toISOString());
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const driverStats = {};

    orders.forEach(order => {
      const did = order.driver_id;
      if (!did) return;

      if (!driverStats[did]) {
        driverStats[did] = {
          driver_id: did,
          driver_name: order.driver_name || 'غير معروف',
          total_trips: 0,
          total_delivery_fees: 0,
          driver_earnings: 0,
          store_commission: 0,
          commission_rate: 0,
          trips_by_payment: {
            cash: 0,
            electronic: 0
          },
          delivery_fees_by_payment: {
            cash: 0,
            electronic: 0
          },
          daily_stats: {}
        };
      }

      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];

      driverStats[did].total_trips += 1;
      driverStats[did].total_delivery_fees += deliveryFee;

      if (!driverStats[did].daily_stats[orderDate]) {
        driverStats[did].daily_stats[orderDate] = {
          trips: 0,
          delivery_fees: 0
        };
      }
      driverStats[did].daily_stats[orderDate].trips += 1;
      driverStats[did].daily_stats[orderDate].delivery_fees += deliveryFee;

      if (order.payment_method === 'cash') {
        driverStats[did].trips_by_payment.cash += 1;
        driverStats[did].delivery_fees_by_payment.cash += deliveryFee;
      } else {
        driverStats[did].trips_by_payment.electronic += 1;
        driverStats[did].delivery_fees_by_payment.electronic += deliveryFee;
      }
    });

    const driverIds = Object.keys(driverStats);
    if (driverIds.length > 0) {
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select('id, commission_rate, rating, rating_count')
        .in('id', driverIds);

      if (driversError) throw driversError;

      drivers.forEach(driver => {
        if (driverStats[driver.id]) {
          const commissionRate = parseFloat(driver.commission_rate) || 15;
          driverStats[driver.id].commission_rate = commissionRate;

          const totalFees = driverStats[driver.id].total_delivery_fees;
          const storeCommission = (totalFees * commissionRate) / 100;
          const driverEarnings = totalFees - storeCommission;

          driverStats[driver.id].store_commission = storeCommission;
          driverStats[driver.id].driver_earnings = driverEarnings;
          driverStats[driver.id].rating = parseFloat(driver.rating) || 0;
          driverStats[driver.id].rating_count = driver.rating_count || 0;
        }
      });
    }

    return Object.values(driverStats);
  } catch (error) {
    console.error('Error fetching driver statistics:', error);
    throw error;
  }
}

export async function getDriverDetailedStatistics(driverId) {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        total,
        delivery_fee,
        status,
        payment_method,
        created_at
      `)
      .eq('driver_id', driverId);

    if (error) throw error;

    const completedOrders = orders.filter(o => o.status === 'completed');
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    const totalDeliveryFees = completedOrders.reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);
    const cashFees = completedOrders
      .filter(o => o.payment_method === 'cash')
      .reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);
    const electronicFees = completedOrders
      .filter(o => o.payment_method !== 'cash')
      .reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);

    const { data: driver } = await supabase
      .from('drivers')
      .select('commission_rate, rating, rating_count, name')
      .eq('id', driverId)
      .single();

    const commissionRate = parseFloat(driver?.commission_rate) || 15;
    const storeCommission = (totalDeliveryFees * commissionRate) / 100;
    const driverEarnings = totalDeliveryFees - storeCommission;

    const monthlyTrips = Array(12).fill(0);
    const monthlyFees = Array(12).fill(0);

    completedOrders.forEach(order => {
      const month = new Date(order.created_at).getMonth();
      monthlyTrips[month] += 1;
      monthlyFees[month] += parseFloat(order.delivery_fee) || 0;
    });

    return {
      driver_id: driverId,
      driver_name: driver?.name || 'غير معروف',
      total_trips: completedOrders.length,
      pending_trips: pendingOrders.length,
      cancelled_trips: cancelledOrders.length,
      total_delivery_fees: totalDeliveryFees,
      driver_earnings: driverEarnings,
      store_commission: storeCommission,
      commission_rate: commissionRate,
      cash_fees: cashFees,
      electronic_fees: electronicFees,
      rating: parseFloat(driver?.rating) || 0,
      rating_count: driver?.rating_count || 0,
      monthly_trips: monthlyTrips,
      monthly_fees: monthlyFees,
      average_delivery_fee: completedOrders.length > 0 ? totalDeliveryFees / completedOrders.length : 0
    };
  } catch (error) {
    console.error('Error fetching driver detailed statistics:', error);
    throw error;
  }
}
