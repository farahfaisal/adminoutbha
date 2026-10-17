import { supabase } from './supabase';

/**
 * إرسال إشعار دفع
 * @param {Object} notificationData - بيانات الإشعار
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendPaymentNotification = async (notificationData) => {
  try {
    // استخدام جدول notification_logs بدلاً من RPC function
    const { data, error } = await supabase
      .from('notification_logs')
      .insert([{
        user_id: notificationData.user_id,
        vendor_id: notificationData.vendor_id,
        notification_type: notificationData.notification_type || 'payment',
        channel: 'in_app',
        status: 'sent',
        payload: {
          title: notificationData.title,
          message: notificationData.message,
          amount: notificationData.amount,
          transaction_id: notificationData.transaction_id,
          order_id: notificationData.order_id,
          driver_id: notificationData.driver_id,
          customer_id: notificationData.customer_id,
          priority: notificationData.priority || 'normal',
          channels: notificationData.channels || ['in_app'],
          metadata: notificationData.metadata || {}
        }
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data?.id;
  } catch (error) {
    console.error('Error sending payment notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار باستخدام قالب
 * @param {Object} templateData - بيانات القالب
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendTemplatedPaymentNotification = async (templateData) => {
  try {
    // إنشاء رسالة بناءً على القالب
    let title = '';
    let message = '';
    
    switch (templateData.template_name) {
      case 'payment_received':
        title = 'تم استلام الدفع';
        message = `تم استلام دفعة بقيمة ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'} بنجاح`;
        break;
      case 'commission_earned':
        title = 'تم كسب عمولة';
        message = `تم إضافة عمولة بقيمة ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'} إلى محفظتك`;
        break;
      case 'wallet_low_balance':
        title = 'رصيد منخفض';
        message = `رصيد محفظتك منخفض: ${templateData.variables?.balance} ${templateData.variables?.currency || 'شيكل'}`;
        break;
      case 'wallet_charged':
        title = 'تم شحن المحفظة';
        message = `تم شحن محفظتك بمبلغ ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'}`;
        break;
      case 'payment_failed':
        title = 'فشل في الدفع';
        message = `فشل في دفع مبلغ ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'}. السبب: ${templateData.variables?.reason}`;
        break;
      case 'withdrawal_approved':
        title = 'تمت الموافقة على السحب';
        message = `تمت الموافقة على طلب سحب بقيمة ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'}`;
        break;
      case 'withdrawal_rejected':
        title = 'تم رفض السحب';
        message = `تم رفض طلب سحب بقيمة ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'}. السبب: ${templateData.variables?.reason}`;
        break;
      case 'payment_reminder':
        title = 'تذكير بالدفع';
        message = `لديك مبلغ مستحق ${templateData.variables?.amount} ${templateData.variables?.currency || 'شيكل'} بتاريخ ${templateData.variables?.due_date}`;
        break;
      default:
        title = 'إشعار دفع';
        message = 'لديك إشعار دفع جديد';
    }

    return await sendPaymentNotification({
      user_id: templateData.user_id,
      vendor_id: templateData.vendor_id,
      driver_id: templateData.driver_id,
      customer_id: templateData.customer_id,
      notification_type: 'payment',
      title: title,
      message: message,
      amount: templateData.amount,
      transaction_id: templateData.transaction_id,
      order_id: templateData.order_id
    });
  } catch (error) {
    console.error('Error sending templated payment notification:', error);
    throw error;
  }
};

/**
 * الحصول على إشعارات المستخدم
 * @param {string} userId - معرف المستخدم
 * @param {Object} options - خيارات الاستعلام
 * @returns {Promise<Array>} - قائمة الإشعارات
 */
export const getUserPaymentNotifications = async (userId, options = {}) => {
  try {
    let query = supabase
      .from('notification_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user payment notifications:', error);
    throw error;
  }
};

/**
 * تحديث حالة الإشعار إلى مقروء
 * @param {string} notificationId - معرف الإشعار
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .update({ 
        status: 'delivered',
        payload: supabase.raw('payload || \'{"read_at": "' + new Date().toISOString() + '"}\'::jsonb')
      })
      .eq('id', notificationId)
      .select();
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * الحصول على تفضيلات الإشعارات للمستخدم
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - تفضيلات الإشعارات
 */
export const getUserNotificationPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    
    // إذا لم توجد تفضيلات، إنشاء تفضيلات افتراضية
    if (!data) {
      const { data: newPrefs, error: insertError } = await supabase
        .from('notification_settings')
        .insert([{ user_id: userId }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newPrefs;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    throw error;
  }
};

/**
 * تحديث تفضيلات الإشعارات للمستخدم
 * @param {string} userId - معرف المستخدم
 * @param {Object} preferences - التفضيلات الجديدة
 * @returns {Promise<Object>} - التفضيلات المحدثة
 */
export const updateUserNotificationPreferences = async (userId, preferences) => {
  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert([{
        user_id: userId,
        ...preferences
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
};

/**
 * الحصول على قوالب الإشعارات
 * @returns {Promise<Array>} - قائمة القوالب
 */
export const getNotificationTemplates = async () => {
  try {
    // استخدام قوالب ثابتة بدلاً من جدول غير موجود
    const templates = [
      {
        id: '1',
        name: 'payment_received',
        title: 'تم استلام الدفع',
        body: 'تم استلام دفعة بقيمة {amount} {currency} بنجاح',
        status: 'active'
      },
      {
        id: '2',
        name: 'commission_earned',
        title: 'تم كسب عمولة',
        body: 'تم إضافة عمولة بقيمة {amount} {currency} إلى محفظتك',
        status: 'active'
      },
      {
        id: '3',
        name: 'wallet_low_balance',
        title: 'رصيد منخفض',
        body: 'رصيد محفظتك منخفض: {balance} {currency}',
        status: 'active'
      },
      {
        id: '4',
        name: 'wallet_charged',
        title: 'تم شحن المحفظة',
        body: 'تم شحن محفظتك بمبلغ {amount} {currency}',
        status: 'active'
      },
      {
        id: '5',
        name: 'payment_failed',
        title: 'فشل في الدفع',
        body: 'فشل في دفع مبلغ {amount} {currency}. السبب: {reason}',
        status: 'active'
      }
    ];
    
    return templates;
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    throw error;
  }
};

/**
 * إنشاء أو تحديث قالب إشعار
 * @param {Object} templateData - بيانات القالب
 * @returns {Promise<Object>} - القالب المحدث
 */
export const saveNotificationTemplate = async (templateData) => {
  try {
    // في الوقت الحالي، نعيد البيانات كما هي لأن القوالب ثابتة
    return templateData;
  } catch (error) {
    console.error('Error saving notification template:', error);
    throw error;
  }
};

/**
 * حذف قالب إشعار
 * @param {string} templateId - معرف القالب
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const deleteNotificationTemplate = async (templateId) => {
  try {
    // في الوقت الحالي، نعيد true لأن القوالب ثابتة
    return true;
  } catch (error) {
    console.error('Error deleting notification template:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات الإشعارات
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - إحصائيات الإشعارات
 */
export const getNotificationStats = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('status, notification_type, payload')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      unread: data.filter(n => n.status === 'sent').length,
      read: data.filter(n => n.status === 'delivered').length,
      failed: data.filter(n => n.status === 'failed').length,
      urgent: data.filter(n => n.payload?.priority === 'urgent').length,
      high: data.filter(n => n.payload?.priority === 'high').length,
      byType: {}
    };
    
    // إحصائيات حسب النوع
    data.forEach(notification => {
      if (!stats.byType[notification.notification_type]) {
        stats.byType[notification.notification_type] = 0;
      }
      stats.byType[notification.notification_type]++;
    });
    
    return stats;
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    throw error;
  }
};

/**
 * أرشفة الإشعارات القديمة
 * @param {string} userId - معرف المستخدم
 * @param {number} daysOld - عدد الأيام للأرشفة
 * @returns {Promise<number>} - عدد الإشعارات المؤرشفة
 */
export const archiveOldNotifications = async (userId, daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('notification_logs')
      .update({ 
        status: 'archived',
        payload: supabase.raw('payload || \'{"archived_at": "' + new Date().toISOString() + '"}\'::jsonb')
      })
      .eq('user_id', userId)
      .eq('status', 'delivered')
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('Error archiving old notifications:', error);
    throw error;
  }
};

/**
 * إرسال إشعارات دفع تلقائية عند إكمال الطلب
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<Array>} - معرفات الإشعارات المرسلة
 */
export const sendOrderCompletionNotifications = async (orderId) => {
  try {
    // جلب بيانات الطلب
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers!orders_customer_id_fkey(*),
        vendor:vendors!orders_vendor_id_fkey(*),
        driver:drivers!orders_driver_id_fkey(*)
      `)
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    const notifications = [];
    
    // إشعار للعميل
    if (order.customer_id && order.customer) {
      const customerNotification = await sendTemplatedPaymentNotification({
        user_id: order.customer?.user_id || order.customer?.auth_user_id,
        template_name: 'payment_received',
        variables: {
          amount: order.total,
          currency: 'شيكل',
          customer_name: order.customer?.name || 'العميل'
        },
        amount: order.total,
        order_id: orderId,
        customer_id: order.customer_id
      });
      
      if (customerNotification) {
        notifications.push(customerNotification);
      }
    }
    
    // إشعار للبائع
    if (order.vendor_id && order.vendor?.user_id) {
      const vendorNotification = await sendTemplatedPaymentNotification({
        user_id: order.vendor.user_id,
        template_name: 'commission_earned',
        variables: {
          amount: (order.total * 0.1).toFixed(2), // 10% عمولة افتراضية
          currency: 'شيكل',
          order_number: order.order_number || order.id.substring(0, 8)
        },
        amount: order.total * 0.1,
        order_id: orderId,
        vendor_id: order.vendor_id
      });
      
      if (vendorNotification) {
        notifications.push(vendorNotification);
      }
    }
    
    // إشعار للسائق
    if (order.driver_id && order.driver?.user_id) {
      const driverNotification = await sendTemplatedPaymentNotification({
        user_id: order.driver.user_id,
        template_name: 'commission_earned',
        variables: {
          amount: (order.delivery_fee * 0.85).toFixed(2), // 85% من رسوم التوصيل
          currency: 'شيكل',
          order_number: order.order_number || order.id.substring(0, 8)
        },
        amount: order.delivery_fee * 0.85,
        order_id: orderId,
        driver_id: order.driver_id
      });
      
      if (driverNotification) {
        notifications.push(driverNotification);
      }
    }
    
    return notifications;
  } catch (error) {
    console.error('Error sending order completion notifications:', error);
    throw error;
  }
};

/**
 * إرسال إشعار رصيد منخفض
 * @param {string} userId - معرف المستخدم
 * @param {number} balance - الرصيد الحالي
 * @param {number} threshold - الحد الأدنى للرصيد
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendLowBalanceNotification = async (userId, balance, threshold = 100) => {
  try {
    if (balance > threshold) {
      return null; // لا حاجة لإرسال إشعار
    }
    
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'wallet_low_balance',
      variables: {
        balance: balance.toFixed(2),
        currency: 'شيكل'
      }
    });
  } catch (error) {
    console.error('Error sending low balance notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار شحن المحفظة
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ المشحون
 * @param {string} transactionId - معرف المعاملة
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendWalletChargeNotification = async (userId, amount, transactionId) => {
  try {
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'wallet_charged',
      variables: {
        amount: amount.toFixed(2),
        currency: 'شيكل'
      },
      amount: amount,
      transaction_id: transactionId
    });
  } catch (error) {
    console.error('Error sending wallet charge notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار فشل الدفع
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ
 * @param {string} reason - سبب الفشل
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendPaymentFailedNotification = async (userId, amount, reason) => {
  try {
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'payment_failed',
      variables: {
        amount: amount.toFixed(2),
        currency: 'شيكل',
        reason: reason
      },
      amount: amount
    });
  } catch (error) {
    console.error('Error sending payment failed notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار الموافقة على السحب
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ
 * @param {string} transactionId - معرف المعاملة
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendWithdrawalApprovedNotification = async (userId, amount, transactionId) => {
  try {
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'withdrawal_approved',
      variables: {
        amount: amount.toFixed(2),
        currency: 'شيكل'
      },
      amount: amount,
      transaction_id: transactionId
    });
  } catch (error) {
    console.error('Error sending withdrawal approved notification:', error);
    throw error;
  }
};

/**
 * إرسال إشعار رفض السحب
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ
 * @param {string} reason - سبب الرفض
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendWithdrawalRejectedNotification = async (userId, amount, reason) => {
  try {
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'withdrawal_rejected',
      variables: {
        amount: amount.toFixed(2),
        currency: 'شيكل',
        reason: reason
      },
      amount: amount
    });
  } catch (error) {
    console.error('Error sending withdrawal rejected notification:', error);
    throw error;
  }
};

/**
 * إرسال تذكير بالدفع
 * @param {string} userId - معرف المستخدم
 * @param {number} amount - المبلغ المستحق
 * @param {string} dueDate - تاريخ الاستحقاق
 * @returns {Promise<string>} - معرف الإشعار
 */
export const sendPaymentReminderNotification = async (userId, amount, dueDate) => {
  try {
    return await sendTemplatedPaymentNotification({
      user_id: userId,
      template_name: 'payment_reminder',
      variables: {
        amount: amount.toFixed(2),
        currency: 'شيكل',
        due_date: new Date(dueDate).toLocaleDateString('ar-SA')
      },
      amount: amount
    });
  } catch (error) {
    console.error('Error sending payment reminder notification:', error);
    throw error;
  }
};

/**
 * الحصول على عدد الإشعارات غير المقروءة
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<number>} - عدد الإشعارات غير المقروءة
 */
export const getUnreadNotificationsCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent');
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching unread notifications count:', error);
    return 0;
  }
};

/**
 * تحديد جميع الإشعارات كمقروءة
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<number>} - عدد الإشعارات المحدثة
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .update({ 
        status: 'delivered',
        payload: supabase.raw('payload || \'{"read_at": "' + new Date().toISOString() + '"}\'::jsonb')
      })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .select('id');
    
    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};