import { supabase, supabaseQuery } from './supabase.js'

export const fetchStatistics = async () => {
  try {
    // Use the enhanced query wrapper with fallback data
    const ordersResult = await supabaseQuery(
      () => supabase.from('orders').select('total'),
      { 
        fallbackData: [],
        maxRetries: 3,
        delay: 1000
      }
    );

    const allOrdersResult = await supabaseQuery(
      () => supabase.from('orders').select('*'),
      { 
        fallbackData: [],
        maxRetries: 3,
        delay: 1000
      }
    );

    const usersResult = await supabaseQuery(
      () => supabase.from('profiles').select('id'),
      { 
        fallbackData: [],
        maxRetries: 3,
        delay: 1000
      }
    );

    const vendorsResult = await supabaseQuery(
      () => supabase.from('vendors').select('id'),
      { 
        fallbackData: [],
        maxRetries: 3,
        delay: 1000
      }
    );

    const productsResult = await supabaseQuery(
      () => supabase.from('products').select('id'),
      { 
        fallbackData: [],
        maxRetries: 3,
        delay: 1000
      }
    );

    // Calculate statistics with fallback values
    const orders = ordersResult.data || [];
    const allOrders = allOrdersResult.data || [];
    const users = usersResult.data || [];
    const vendors = vendorsResult.data || [];
    const products = productsResult.data || [];

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = allOrders.length;
    const totalUsers = users.length;
    const totalVendors = vendors.length;
    const totalProducts = products.length;

    // Calculate recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = allOrders.filter(order => {
      if (!order.created_at) return false;
      return new Date(order.created_at) >= sevenDaysAgo;
    }).length;

    return {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalVendors,
      totalProducts,
      recentOrders,
      connectionStatus: 'connected'
    };
  } catch (error) {
    console.error('Error fetching statistics:', error.message);
    
    // Return default statistics when connection fails
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalVendors: 0,
      totalProducts: 0,
      recentOrders: 0,
      connectionStatus: 'disconnected',
      error: error.message
    };
  }
};

/**
 * الحصول على الإحصائيات المالية
 * @returns {Promise<Object>} - البيانات الإحصائية
 */
export const getFinancialStats = async () => {
  try {
    const { data, error } = await supabase.rpc('get_financial_summary');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching financial stats:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات المبيعات الشهرية
 * @returns {Promise<Object>} - بيانات المبيعات الشهرية
 */
export const getMonthlySalesStats = async () => {
  try {
    // Get orders from the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data, error } = await supabase
      .from('orders')
      .select('total, created_at')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group orders by month
    const monthlyStats = {};
    const months = [];
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats[monthKey] = {
        month: monthKey,
        revenue: 0,
        orders: 0
      };
      months.push(monthKey);
    }

    // Process orders
    (data || []).forEach(order => {
      const orderDate = new Date(order.created_at);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyStats[monthKey]) {
        monthlyStats[monthKey].revenue += order.total || 0;
        monthlyStats[monthKey].orders += 1;
      }
    });

    const monthlyData = months.map(month => monthlyStats[month]);
    const monthlySales = monthlyData.map(item => item.revenue);

    return {
      monthlySales,
      monthlyData
    };
  } catch (error) {
    console.error('Error fetching monthly sales stats:', error);
    
    // Return empty data for last 12 months
    const months = [];
    const monthlySales = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: monthKey,
        revenue: 0,
        orders: 0
      });
      monthlySales.push(0);
    }
    return {
      monthlySales,
      monthlyData: months
    };
  }
};