import { supabase } from './supabase';

/**
 * الحصول على رصيد نقاط العميل
 * @param {string} customerId - معرف العميل
 * @returns {Promise<Object>} - بيانات رصيد النقاط
 */
export const getCustomerPoints = async (customerId) => {
  try {
    const { data, error } = await supabase
      .from('points_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching customer points:', error);
    return null;
  }
};

/**
 * الحصول على معاملات نقاط العميل
 * @param {string} customerId - معرف العميل
 * @returns {Promise<Array>} - قائمة معاملات النقاط
 */
export const getCustomerPointsTransactions = async (customerId) => {
  try {
    const { data: account, error: accountError } = await supabase
      .from('points_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    
    if (accountError) throw accountError;
    
    const { data, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching customer points transactions:', error);
    return [];
  }
};

/**
 * إضافة نقاط للعميل
 * @param {string} customerId - معرف العميل
 * @param {number} points - عدد النقاط
 * @param {string} description - وصف المعاملة
 * @returns {Promise<Object>} - نتيجة العملية
 */
export const addPointsToCustomer = async (customerId, points, description = 'إضافة نقاط يدوية') => {
  try {
    const { data, error } = await supabase.rpc(
      'add_points_to_customer',
      {
        p_customer_id: customerId,
        p_points: points,
        p_description: description
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding points to customer:', error);
    throw error;
  }
};

/**
 * استبدال النقاط بمكافأة
 * @param {string} customerId - معرف العميل
 * @param {string} rewardId - معرف المكافأة
 * @returns {Promise<Object>} - نتيجة العملية
 */
export const redeemPoints = async (customerId, rewardId) => {
  try {
    // الحصول على حساب نقاط العميل
    const { data: account, error: accountError } = await supabase
      .from('points_accounts')
      .select('id, balance')
      .eq('customer_id', customerId)
      .single();
    
    if (accountError) throw accountError;
    
    // الحصول على بيانات المكافأة
    const { data: reward, error: rewardError } = await supabase
      .from('points_rewards')
      .select('*')
      .eq('id', rewardId)
      .single();
    
    if (rewardError) throw rewardError;
    
    // التحقق من أن العميل لديه نقاط كافية
    if (account.balance < reward.points_cost) {
      throw new Error('رصيد النقاط غير كافٍ');
    }
    
    // إنشاء رمز استرداد فريد
    const redemptionCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // إنشاء سجل استرداد
    const { data: redemption, error: redemptionError } = await supabase
      .from('points_redemptions')
      .insert([{
        account_id: account.id,
        reward_id: rewardId,
        points_spent: reward.points_cost,
        status: 'active',
        code: redemptionCode,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // تنتهي بعد 30 يوم
      }])
      .select();
    
    if (redemptionError) throw redemptionError;
    
    // خصم النقاط من حساب العميل
    const { error: updateError } = await supabase
      .from('points_accounts')
      .update({
        balance: account.balance - reward.points_cost,
        total_spent: account.total_spent + reward.points_cost,
        last_activity: new Date().toISOString()
      })
      .eq('id', account.id);
    
    if (updateError) throw updateError;
    
    // إضافة معاملة نقاط
    const { error: transactionError } = await supabase
      .from('points_transactions')
      .insert([{
        account_id: account.id,
        amount: reward.points_cost,
        type: 'spend',
        description: `استبدال نقاط بـ ${reward.name}`
      }]);
    
    if (transactionError) throw transactionError;
    
    return {
      success: true,
      redemption: redemption[0],
      code: redemptionCode
    };
  } catch (error) {
    console.error('Error redeeming points:', error);
    throw error;
  }
};

/**
 * التحقق من صحة استخدام النقاط
 * @param {string} customerId - معرف العميل
 * @param {number} pointsToUse - عدد النقاط المراد استخدامها
 * @param {number} orderTotal - إجمالي قيمة الطلب
 * @returns {Promise<Object>} - نتيجة التحقق
 */
export const validatePointsUsage = async (customerId, pointsToUse, orderTotal) => {
  try {
    // الحصول على رصيد نقاط العميل
    const customerPoints = await getCustomerPoints(customerId);
    
    if (!customerPoints) {
      return {
        valid: false,
        message: 'لا يوجد حساب نقاط لهذا العميل'
      };
    }
    
    // التحقق من أن العميل لديه نقاط كافية
    if (pointsToUse > customerPoints.balance) {
      return {
        valid: false,
        message: 'رصيد النقاط غير كافٍ'
      };
    }
    
    // حساب قيمة الخصم (كل 100 نقطة = 1 شيكل)
    const discountAmount = pointsToUse * 0.01;

    // التحقق من الحد الأقصى للخصم (50% من قيمة الطلب)
    const maxDiscountAllowed = orderTotal * 0.5;
    if (discountAmount > maxDiscountAllowed) {
      return {
        valid: false,
        message: `الحد الأقصى للخصم هو 50% من قيمة الطلب (${maxDiscountAllowed.toFixed(2)} شيكل)`
      };
    }
    
    // التحقق من أن المبلغ المتبقي لا يقل عن 10 شيكل
    const remainingAmount = orderTotal - discountAmount;
    if (remainingAmount < 10) {
      return {
        valid: false,
        message: 'يجب أن يبقى مبلغ لا يقل عن 10 شيكل بعد الخصم'
      };
    }
    
    return {
      valid: true,
      discountAmount,
      remainingAmount,
      message: 'النقاط صالحة للاستخدام'
    };
  } catch (error) {
    console.error('Error validating points usage:', error);
    return {
      valid: false,
      message: 'فشل في التحقق من النقاط'
    };
  }
};

/**
 * تطبيق النقاط على الطلب
 * @param {string} orderId - معرف الطلب
 * @param {string} customerId - معرف العميل
 * @param {number} pointsToUse - عدد النقاط المراد استخدامها
 * @returns {Promise<Object>} - نتيجة العملية
 */
export const applyPointsToOrder = async (orderId, customerId, pointsToUse) => {
  try {
    // الحصول على بيانات الطلب
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    // التحقق من أن الطلب لم يتم تطبيق نقاط عليه مسبقاً
    if (order.points_applied > 0) {
      return {
        success: false,
        message: 'تم تطبيق نقاط على هذا الطلب مسبقاً'
      };
    }
    
    // التحقق من صحة استخدام النقاط
    const validation = await validatePointsUsage(customerId, pointsToUse, order.total);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }
    
    // الحصول على حساب نقاط العميل
    const customerPoints = await getCustomerPoints(customerId);
    if (!customerPoints) {
      return {
        success: false,
        message: 'لا يوجد حساب نقاط لهذا العميل'
      };
    }
    
    // حساب قيمة الخصم
    const discountAmount = pointsToUse * 0.01;
    const newTotal = order.total - discountAmount;
    
    // إنشاء رمز استرداد فريد
    const redemptionCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // تحديث الطلب بالنقاط المطبقة
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        points_applied: pointsToUse,
        points_discount: discountAmount,
        total: newTotal,
        redemption_code: redemptionCode
      })
      .eq('id', orderId);
    
    if (updateOrderError) throw updateOrderError;
    
    // خصم النقاط من حساب العميل
    const { error: updatePointsError } = await supabase
      .from('points_accounts')
      .update({
        balance: customerPoints.balance - pointsToUse,
        total_spent: customerPoints.total_spent + pointsToUse,
        last_activity: new Date().toISOString()
      })
      .eq('id', customerPoints.id);
    
    if (updatePointsError) throw updatePointsError;
    
    // إضافة معاملة نقاط
    const { error: transactionError } = await supabase
      .from('points_transactions')
      .insert([{
        account_id: customerPoints.id,
        order_id: orderId,
        amount: pointsToUse,
        type: 'spend',
        description: `استخدام نقاط على الطلب #${order.order_number || orderId.substring(0, 8)}`
      }]);
    
    if (transactionError) throw transactionError;
    
    return {
      success: true,
      points_used: pointsToUse,
      discount_amount: discountAmount,
      new_total: newTotal,
      redemption_code: redemptionCode,
      message: 'تم تطبيق النقاط بنجاح'
    };
  } catch (error) {
    console.error('Error applying points to order:', error);
    return {
      success: false,
      message: 'فشل في تطبيق النقاط'
    };
  }
};

/**
 * الحصول على قائمة استردادات النقاط للعميل
 * @param {string} customerId - معرف العميل
 * @returns {Promise<Array>} - قائمة الاستردادات
 */
export const getCustomerRedemptions = async (customerId) => {
  try {
    const { data: account, error: accountError } = await supabase
      .from('points_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    
    if (accountError) throw accountError;
    
    const { data, error } = await supabase
      .from('points_redemptions')
      .select(`
        *,
        reward:reward_id(*)
      `)
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching customer redemptions:', error);
    return [];
  }
};