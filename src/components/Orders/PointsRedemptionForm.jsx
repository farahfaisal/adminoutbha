import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getCustomerPoints, applyPointsToOrder, validatePointsUsage } from '../../lib/pointsApi';

export default function PointsRedemptionForm({ 
  orderId, 
  customerId, 
  orderTotal, 
  onPointsApplied, 
  onClose 
}) {
  const [customerPoints, setCustomerPoints] = useState(null);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    fetchCustomerPoints();
  }, [customerId]);

  useEffect(() => {
    if (pointsToUse > 0 && customerPoints) {
      validatePoints();
    } else {
      setValidation(null);
    }
  }, [pointsToUse, customerPoints, orderTotal]);

  const fetchCustomerPoints = async () => {
    try {
      setLoading(true);
      const points = await getCustomerPoints(customerId);
      setCustomerPoints(points);
    } catch (error) {
      console.error('Error fetching customer points:', error);
      toast.error('فشل في تحميل نقاط العميل');
    } finally {
      setLoading(false);
    }
  };

  const validatePoints = async () => {
    try {
      const result = await validatePointsUsage(customerId, pointsToUse, orderTotal);
      setValidation(result);
    } catch (error) {
      console.error('Error validating points:', error);
      setValidation({
        valid: false,
        message: 'فشل في التحقق من النقاط'
      });
    }
  };

  const handleApplyPoints = async () => {
    if (!validation || !validation.valid) {
      toast.error(validation?.message || 'النقاط غير صالحة للاستخدام');
      return;
    }

    try {
      setApplying(true);
      const result = await applyPointsToOrder(orderId, customerId, pointsToUse);
      
      if (result.success) {
        toast.success('تم تطبيق النقاط بنجاح');
        onPointsApplied({
          pointsUsed: result.points_used,
          discountAmount: result.discount_amount,
          newTotal: result.new_total,
          redemptionCode: result.redemption_code
        });
        onClose();
      } else {
        toast.error(result.message || 'فشل في تطبيق النقاط');
      }
    } catch (error) {
      console.error('Error applying points:', error);
      toast.error('فشل في تطبيق النقاط');
    } finally {
      setApplying(false);
    }
  };

  const calculateDiscount = (points) => {
    return points * 0.01; // كل 100 نقطة = 1 شيكل
  };

  const getMaxUsablePoints = () => {
    if (!customerPoints) return 0;

    // الحد الأقصى هو 50% من قيمة الطلب
    const maxDiscountAllowed = orderTotal * 0.5;
    const maxPointsByDiscount = Math.floor(maxDiscountAllowed / 0.01);

    return Math.min(customerPoints.balance, maxPointsByDiscount);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customerPoints || customerPoints.balance === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg text-center">
        <p className="text-gray-600">لا يوجد نقاط متاحة لهذا العميل</p>
      </div>
    );
  }

  const maxUsablePoints = getMaxUsablePoints();

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">استخدام النقاط</h3>
      
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">رصيد النقاط المتاح:</span>
            <span className="text-blue-600 font-bold">{customerPoints.balance} نقطة</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">الحد الأقصى للاستخدام:</span>
            <span className="text-sm text-gray-600">{maxUsablePoints} نقطة</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            عدد النقاط المراد استخدامها
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={pointsToUse}
              onChange={(e) => setPointsToUse(parseInt(e.target.value) || 0)}
              className="flex-1 border rounded-md px-3 py-2"
              min="0"
              max={maxUsablePoints}
              placeholder="أدخل عدد النقاط"
            />
            <button
              type="button"
              onClick={() => setPointsToUse(maxUsablePoints)}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              الحد الأقصى
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            كل 100 نقطة = 1 شيكل خصم
          </p>
        </div>

        {pointsToUse > 0 && (
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>النقاط المستخدمة:</span>
                <span className="font-medium">{pointsToUse} نقطة</span>
              </div>
              <div className="flex justify-between">
                <span>قيمة الخصم:</span>
                <span className="font-medium text-green-600">₪{calculateDiscount(pointsToUse).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">المجموع بعد الخصم:</span>
                <span className="font-bold text-green-600">
                  ₪{(orderTotal - calculateDiscount(pointsToUse)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {validation && !validation.valid && (
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-red-800 text-sm">{validation.message}</p>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleApplyPoints}
            disabled={applying || !validation?.valid || pointsToUse === 0}
            className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
              applying || !validation?.valid || pointsToUse === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
          >
            {applying ? 'جاري التطبيق...' : 'تطبيق النقاط'}
          </button>
        </div>
      </div>
    </div>
  );
}