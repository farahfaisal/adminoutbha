import { supabase } from './supabase';
import { sendWalletChargeNotification, sendLowBalanceNotification } from './paymentNotificationsApi';

// Create a service role client for admin operations
const supabaseAdmin = supabase;

/**
 * الحصول على طرق الدفع المتاحة
 * @returns {Promise<Array>} - قائمة طرق الدفع
 */
const getPaymentMethods = async () => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('status', 'active')
      .order('id');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
};

/**
 * الحصول على رصيد المحفظة لمستخدم معين
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - بيانات الرصيد
 */
const getWalletBalance = async (userId) => {
  try {
    const { data, error } = await supabase.rpc('get_wallet_balance', { p_user_id: userId });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    throw error;
  }
};

/**
 * الحصول على معاملات المحفظة
 * @param {string} walletId - معرف المحفظة
 * @param {Object} options - خيارات الفلترة
 * @returns {Promise<Array>} - قائمة المعاملات
 */
export const getWalletTransactions = async (walletId, options = {}) => {
  try {
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const from = offset;
    const to = offset + limit - 1;
    
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw error;
  }
};

/**
 * الحصول على محافظ الزبائن
 * @returns {Promise<Array>} - قائمة محافظ الزبائن
 */
export const getCustomerWallets = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_wallets')
      .select(`
        *,
        customer:customer_id (
          id,
          name,
          phone,
          email
        )
      `);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching customer wallets:', error);
    throw error;
  }
};

/**
 * الحصول على محافظ البائعين
 * @returns {Promise<Array>} - قائمة محافظ البائعين
 */
export const getVendorWallets = async () => {
  try {
    // Direct query instead of RPC
    const { data, error } = await supabase
      .from('vendor_wallets')
      .select(`
        *,
        vendor:vendor_id (
          id,
          store_name,
          status,
          user_id
        )
      `);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor wallets:', error);
    throw error;
  }
};

/**
 * الحصول على محافظ السائقين
 * @returns {Promise<Array>} - قائمة محافظ السائقين
 */
export const getDriverWallets = async () => {
  try {
    const { data, error } = await supabase
      .from('driver_wallets')
      .select(`
        *,
        driver:driver_id (
          id,
          name,
          status,
          user_id
        )
      `);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching driver wallets:', error);
    throw error;
  }
};

/**
 * شحن رصيد محفظة بائع
 * @param {string} vendorId - معرف البائع
 * @param {number} amount - المبلغ المراد شحنه
 * @param {string} description - وصف المعاملة
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const chargeVendorWallet = async (vendorId, amount, description = 'شحن رصيد') => {
  try {
    console.log("Calling charge_vendor_wallet_direct with:", vendorId, amount, description);
    
    const { data, error } = await supabase.rpc(
      'charge_vendor_wallet_direct',
      {
        p_vendor_id: vendorId,
        p_amount: amount,
        p_description: description
      }
    );
    
    console.log("RPC response:", data, error);
    
    if (error) {
      console.error("RPC error:", error);
      throw new Error(`فشل في شحن محفظة البائع: ${error.message}`);
    }
    
    // إرسال إشعار شحن المحفظة
    try {
      if (vendorId) {
        // الحصول على معرف المستخدم للبائع
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('user_id')
          .eq('id', vendorId)
          .single();
        
        if (vendorData?.user_id) {
          await sendWalletChargeNotification(vendorData.user_id, amount, 'vendor_charge');
        }
      }
    } catch (notificationError) {
      console.error('Error sending vendor wallet charge notification:', notificationError);
    }
    
    return data;
  } catch (error) {
    console.error('Error charging vendor wallet:', error);
    throw error;
  }
};

/**
 * شحن رصيد محفظة بائع مباشرة
 * @param {string} vendorId - معرف البائع
 * @param {number} amount - المبلغ المراد شحنه
 * @param {string} description - وصف المعاملة
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const chargeVendorWalletDirect = async (vendorId, amount, description = 'شحن رصيد مباشر') => {
  try {
    const { data, error } = await supabase.rpc(
      'charge_vendor_wallet_direct',
      {
        p_vendor_id: vendorId,
        p_amount: amount,
        p_description: description
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error charging vendor wallet directly:', error);
    throw error;
  }
};

/**
 * شحن رصيد محفظة سائق
 * @param {string} driverId - معرف السائق
 * @param {number} amount - المبلغ المراد شحنه
 * @param {string} description - وصف المعاملة
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const chargeDriverWallet = async (driverId, amount, description = 'شحن رصيد') => {
  try {
    console.log("Calling charge_driver_wallet_direct with:", driverId, amount, description);
    
    const { data, error } = await supabase.rpc(
      'charge_driver_wallet_direct',
      {
        p_driver_id: driverId,
        p_amount: amount,
        p_description: description
      }
    );
    
    console.log("RPC response:", data, error);
    
    if (error) {
      console.error("RPC error:", error);
      throw new Error(`فشل في شحن محفظة السائق: ${error.message}`);
    }
    
    // إرسال إشعار شحن المحفظة
    try {
      if (driverId) {
        // الحصول على معرف المستخدم للسائق
        const { data: driverData } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', driverId)
          .single();
        
        if (driverData?.user_id) {
          await sendWalletChargeNotification(driverData.user_id, amount, 'driver_charge');
        }
      }
    } catch (notificationError) {
      console.error('Error sending driver wallet charge notification:', notificationError);
    }
    
    return data;
  } catch (error) {
    console.error('Error charging driver wallet:', error);
    throw error;
  }
};

/**
 * شحن رصيد محفظة سائق مباشرة
 * @param {string} driverId - معرف السائق
 * @param {number} amount - المبلغ المراد شحنه
 * @param {string} description - وصف المعاملة
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const chargeDriverWalletDirect = async (driverId, amount, description = 'شحن رصيد مباشر') => {
  try {
    const { data, error } = await supabase.rpc(
      'charge_driver_wallet_direct',
      {
        p_driver_id: driverId,
        p_amount: amount,
        p_description: description
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error charging driver wallet directly:', error);
    throw error;
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
 * الحصول على إعدادات الدفع
 * @returns {Promise<Object>} - إعدادات الدفع
 */
export const getPaymentSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('settings')
      .single();
    
    if (error) throw error;
    
    // استخراج إعدادات الدفع
    const paymentSettings = data.settings.payment || {};
    return paymentSettings;
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    throw error;
  }
};

/**
 * تحديث إعدادات الدفع
 * @param {Object} settings - الإعدادات الجديدة
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const updatePaymentSettings = async (settings) => {
  try {
    // أولاً، الحصول على الإعدادات الحالية
    const { data: currentData, error: fetchError } = await supabase
      .from('app_settings')
      .select('settings')
      .single();
    
    if (fetchError) throw fetchError;
    
    // تحديث قسم الدفع فقط
    const updatedSettings = {
      ...currentData.settings,
      payment: settings
    };
    
    // حفظ الإعدادات المحدثة
    const { error } = await supabase
      .from('app_settings')
      .update({ settings: updatedSettings })
      .eq('id', currentData.id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating payment settings:', error);
    throw error;
  }
};

/**
 * الحصول على محفظة بائع محدد
 * @param {string} vendorId - معرف البائع
 * @returns {Promise<Object>} - بيانات محفظة البائع
 */
export const getVendorWallet = async (vendorId) => {
  try {
    const { data, error } = await supabase
      .from('vendor_wallets')
      .select(`
        *,
        vendor:vendor_id (
          id,
          store_name,
          status,
          user_id
        )
      `)
      .eq('vendor_id', vendorId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching vendor wallet:', error);
    throw error;
  }
};

/**
 * الحصول على محفظة سائق محدد
 * @param {string} driverId - معرف السائق
 * @returns {Promise<Object>} - بيانات محفظة السائق
 */
export const getDriverWallet = async (driverId) => {
  try {
    const { data, error } = await supabase
      .from('driver_wallets')
      .select(`
        *,
        driver:driver_id (
          id,
          name,
          status,
          user_id
        )
      `)
      .eq('driver_id', driverId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching driver wallet:', error);
    throw error;
  }
};

/**
 * شحن رصيد محفظة زبون
 * @param {string} customerId - معرف الزبون
 * @param {number} amount - المبلغ المراد شحنه
 * @param {string} description - وصف المعاملة
 * @param {string} status - حالة المعاملة (pending أو completed)
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const chargeCustomerWallet = async (customerId, amount, description = 'شحن رصيد', status = 'completed') => {
  try {
    console.log("Charging customer wallet:", customerId, amount, description);

    // First, get or create the customer wallet from customer_wallets table
    let { data: wallet, error: walletError } = await supabaseAdmin
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (walletError && walletError.code !== 'PGRST116') {
      throw walletError;
    }

    // If wallet doesn't exist, create it
    if (!wallet) {
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('customer_wallets')
        .insert({
          customer_id: customerId,
          balance: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_spent: 0
        })
        .select()
        .single();

      if (createError) throw createError;
      wallet = newWallet;
    }

    // Create customer wallet transaction
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('customer_wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        amount: amount,
        type: 'deposit',
        payment_type: 'admin_adjustment',
        status: status,
        description: description,
        reference_id: `admin_charge_${Date.now()}`,
        metadata: {
          charged_by: 'admin',
          charge_type: 'manual'
        }
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    // Only update wallet balance if status is completed
    let newBalance = parseFloat(wallet.balance || 0);
    let newTotalDeposits = parseFloat(wallet.total_deposits || 0);
    
    if (status === 'completed') {
      newBalance += parseFloat(amount);
      newTotalDeposits += parseFloat(amount);

      const { error: updateError } = await supabaseAdmin
        .from('customer_wallets')
        .update({
          balance: newBalance,
          total_deposits: newTotalDeposits,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (updateError) throw updateError;
    }

    console.log("Customer wallet charged successfully");
    
    // إرسال إشعار شحن المحفظة
    try {
      if (status === 'completed' && customerId) {
        // الحصول على معرف المستخدم للعميل
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id, auth_user_id')
          .eq('id', customerId)
          .single();
        
        const userId = customerData?.user_id || customerData?.auth_user_id;
        if (userId) {
          await sendWalletChargeNotification(userId, amount, transaction.id);
        }
      }
    } catch (notificationError) {
      console.error('Error sending wallet charge notification:', notificationError);
      // لا نرمي خطأ هنا لأن العملية الأساسية نجحت
    }
    
    return {
      success: true,
      transaction_id: transaction.id,
      new_balance: newBalance,
      amount_added: status === 'completed' ? amount : 0,
      status: status
    };
  } catch (error) {
    console.error('Error charging customer wallet:', error);
    throw error;
  }
};

/**
 * طلب إيداع من العميل (يتطلب موافقة المدير)
 * @param {string} customerId - معرف الزبون
 * @param {number} amount - المبلغ المراد إيداعه
 * @param {string} description - وصف المعاملة
 * @param {string} paymentType - طريقة الدفع
 * @returns {Promise<Object>} - بيانات المعاملة
 */
export const requestCustomerDeposit = async (customerId, amount, description = 'طلب إيداع', paymentType = 'cash') => {
  try {
    console.log("Requesting customer deposit:", customerId, amount, description);

    // Get or create customer wallet
    let { data: wallet, error: walletError } = await supabase
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (walletError && walletError.code !== 'PGRST116') {
      throw walletError;
    }

    // If wallet doesn't exist, create it
    if (!wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('customer_wallets')
        .insert({
          customer_id: customerId,
          balance: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_spent: 0
        })
        .select()
        .single();

      if (createError) throw createError;
      wallet = newWallet;
    }

    // Create pending deposit transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('customer_wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        amount: amount,
        type: 'deposit',
        payment_type: paymentType,
        status: 'pending',
        description: description,
        reference_id: `customer_deposit_${Date.now()}`,
        metadata: {
          requested_by: 'customer',
          requires_approval: true
        }
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    console.log("Customer deposit request created successfully");
    return {
      success: true,
      transaction_id: transaction.id,
      status: 'pending',
      message: 'تم إرسال طلب الإيداع وهو في انتظار موافقة المدير'
    };
  } catch (error) {
    console.error('Error requesting customer deposit:', error);
    throw error;
  }
};

/**
 * الموافقة على إيداع العميل أو رفضه
 * @param {string} transactionId - معرف المعاملة
 * @param {string} action - الإجراء (approve أو reject)
 * @param {string} note - ملاحظة المدير
 * @returns {Promise<Object>} - نتيجة العملية
 */
export const approveCustomerDeposit = async (transactionId, action, note = '') => {
  try {
    console.log("Approving/rejecting customer deposit:", transactionId, action);

    // Get the transaction details
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('customer_wallet_transactions')
      .select(`
        *,
        wallet:wallet_id(*)
      `)
      .eq('id', transactionId)
      .single();

    if (transactionError) throw transactionError;

    // التحقق من أن المعاملة لم يتم معالجتها بالفعل
    if (transaction.status !== 'pending') {
      throw new Error(`لا يمكن تعديل هذه المعاملة. الحالة الحالية: ${
        transaction.status === 'completed' ? 'مؤكدة' :
        transaction.status === 'failed' ? 'مرفوضة' :
        transaction.status === 'cancelled' ? 'ملغية' :
        transaction.status
      }`);
    }

    if (action === 'approve') {
      // Update transaction status to completed
      const { error: updateTransactionError } = await supabaseAdmin
        .from('customer_wallet_transactions')
        .update({
          status: 'completed',
          metadata: {
            ...transaction.metadata,
            approved_by: 'admin',
            approved_at: new Date().toISOString(),
            approval_note: note
          }
        })
        .eq('id', transactionId);

      if (updateTransactionError) throw updateTransactionError;

      // Update customer wallet balance
      const newBalance = parseFloat(transaction.wallet.balance || 0) + parseFloat(transaction.amount);
      const newTotalDeposits = parseFloat(transaction.wallet.total_deposits || 0) + parseFloat(transaction.amount);

      const { error: updateWalletError } = await supabaseAdmin
        .from('customer_wallets')
        .update({
          balance: newBalance,
          total_deposits: newTotalDeposits,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.wallet_id);

      if (updateWalletError) throw updateWalletError;

      return {
        success: true,
        message: 'تم الموافقة على الإيداع وتحديث رصيد العميل',
        new_balance: newBalance
      };
    } else if (action === 'reject') {
      // Update transaction status to failed
      const { error: updateTransactionError } = await supabaseAdmin
        .from('customer_wallet_transactions')
        .update({
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            rejected_by: 'admin',
            rejected_at: new Date().toISOString(),
            rejection_note: note
          }
        })
        .eq('id', transactionId);

      if (updateTransactionError) throw updateTransactionError;

      return {
        success: true,
        message: 'تم رفض طلب الإيداع'
      };
    } else {
      throw new Error('إجراء غير صالح');
    }
  } catch (error) {
    console.error('Error approving/rejecting customer deposit:', error);
    throw error;
  }
};

/**
 * الحصول على طلبات الإيداع المعلقة
 * @returns {Promise<Array>} - قائمة طلبات الإيداع المعلقة
 */
export const getPendingDeposits = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_wallet_transactions')
      .select(`
        *,
        wallet:wallet_id(
          customer:customer_id(id, name, phone, email)
        )
      `)
      .eq('status', 'pending')
      .eq('type', 'deposit')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pending deposits:', error);
    throw error;
  }
};

/**
 * التحقق من إمكانية تعديل معاملة محفظة العميل
 * @param {string} transactionId - معرف المعاملة
 * @returns {Promise<Object>} - نتيجة التحقق
 */
export const canEditCustomerTransaction = async (transactionId) => {
  try {
    const { data: transaction, error } = await supabase
      .from('customer_wallet_transactions')
      .select('status, type, created_at')
      .eq('id', transactionId)
      .single();
    
    if (error) throw error;
    
    // لا يمكن تعديل المعاملات المؤكدة أو المرفوضة أو الملغية
    const canEdit = transaction.status === 'pending';
    
    return {
      canEdit,
      status: transaction.status,
      reason: canEdit ? null : `المعاملة ${
        transaction.status === 'completed' ? 'مؤكدة' :
        transaction.status === 'failed' ? 'مرفوضة' :
        transaction.status === 'cancelled' ? 'ملغية' :
        'غير قابلة للتعديل'
      }`
    };
  } catch (error) {
    console.error('Error checking transaction edit permission:', error);
    return {
      canEdit: false,
      status: 'unknown',
      reason: 'فشل في التحقق من حالة المعاملة'
    };
  }
};

/**
 * الحصول على معاملات محفظة زبون
 * @param {string} customerId - معرف الزبون
 * @param {Object} options - خيارات الفلترة
 * @returns {Promise<Array>} - قائمة المعاملات
 */
export const getCustomerWalletTransactions = async (customerId, options = {}) => {
  try {
    // First get the customer wallet
    const { data: wallet, error: walletError } = await supabase
      .from('customer_wallets')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();
    
    if (walletError) throw walletError;
    if (!wallet) return [];
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const from = offset;
    const to = offset + limit - 1;
    
    // Then get the transactions
    const { data, error } = await supabase
      .from('customer_wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching customer wallet transactions:', error);
    throw error;
  }
};

/**
 * معالجة دفع طلب
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<Object>} - نتيجة معالجة الدفع
 */
export const processOrderPayment = async (orderId) => {
  try {
    const { data, error } = await supabase.rpc(
      'process_payment_for_order',
      { p_order_id: orderId }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error processing order payment:', error);
    throw error;
  }
};