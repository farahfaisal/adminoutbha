/**
 * Maps UI status values to database-allowed status values for the orders table
 * @param {string} status - The UI status value
 * @returns {string} - The database-allowed status value
 */
export const mapStatusToAllowedValue = (status) => {
  // Based on the orders_status_check constraint, allowed values are:
  // 'pending', 'pending_review', 'accepted', 'processing', 'ready', 'delivering', 'completed', 'rejected', 'cancelled', 'waiting-for-driver', 'shipping', 'delivered'

  // Check if status is already in the allowed list
  if (['pending', 'pending_review', 'accepted', 'processing', 'ready', 'delivering', 'completed', 'rejected', 'cancelled', 'waiting-for-driver', 'shipping', 'delivered'].includes(status)) {
    return status;
  }

  // Map non-allowed values to allowed ones
  switch (status) {
    case 'delivered-to-driver':
      return 'processing'; // Map to processing since it's not in the allowed list
    default:
      return 'processing'; // Default fallback
  }
};

/**
 * Maps UI status values to database-allowed status values for the order_status_history table
 * @param {string} status - The UI status value
 * @returns {string} - The database-allowed status value
 */
export const mapToOrderStatusHistoryValue = (status) => {
  // Based on order_status_history_status_check constraint, allowed values are:
  // 'pending', 'pending_review', 'accepted', 'rejected', 'processing', 'waiting-for-driver',
  // 'delivered-to-driver', 'delivering', 'completed', 'cancelled', 'shipping', 'delivered'

  // Check if status is already in the allowed list
  if (['pending', 'pending_review', 'accepted', 'rejected', 'processing', 'waiting-for-driver',
      'delivered-to-driver', 'delivering', 'completed', 'cancelled', 'shipping', 'delivered'].includes(status)) {
    return status;
  }

  // Default fallback
  return 'processing';
};

/**
 * Get default status note based on status
 * @param {string} status - The status value
 * @returns {string} - The default note for the status
 */
export const getDefaultStatusNote = (status) => {
  switch (status) {
    case 'pending_review': return 'الطلب قيد المراجعة';
    case 'processing': return 'تم بدء تحضير الطلب';
    case 'delivered-to-driver': return 'تم تسليم الطلب للسائق';
    case 'delivering': return 'جاري توصيل الطلب';
    case 'waiting-for-driver': return 'تم إضافة الطلب لقائمة انتظار السائقين';
    case 'completed': return 'تم إكمال الطلب';
    case 'accepted': return 'تم قبول الطلب';
    case 'rejected': return 'تم رفض الطلب';
    case 'cancelled': return 'تم إلغاء الطلب';
    case 'shipping': return 'الطلب قيد الشحن';
    case 'delivered': return 'تم توصيل الطلب';
    default: return `تم تغيير الحالة`;
  }
};