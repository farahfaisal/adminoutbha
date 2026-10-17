import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Navigation } from 'lucide-react';
import { calculateEstimatedDeliveryTime, getDeliveryTimeRange } from '../../utils/deliveryTimeCalculator';

export default function DeliveryTimeEstimate({ vendor, customerAddress }) {
  const [estimatedTime, setEstimatedTime] = useState(null);

  useEffect(() => {
    if (
      vendor?.latitude &&
      vendor?.longitude &&
      customerAddress?.latitude &&
      customerAddress?.longitude
    ) {
      const estimate = calculateEstimatedDeliveryTime(
        vendor.latitude,
        vendor.longitude,
        customerAddress.latitude,
        customerAddress.longitude,
        {
          averageSpeedKmh: 30,
          preparationTimeMinutes: vendor.estimated_delivery_time || 20,
          bufferTimeMinutes: 5
        }
      );

      setEstimatedTime(estimate);
    }
  }, [vendor, customerAddress]);

  if (!estimatedTime) {
    return null;
  }

  const timeRange = getDeliveryTimeRange(estimatedTime.totalTimeMinutes);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
      <div className="flex items-start gap-3">
        <div className="bg-blue-600 rounded-full p-2">
          <Clock className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2">
            وقت التوصيل المتوقع
          </h4>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">
                {timeRange.range}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4" />
                <span>المسافة: {estimatedTime.distanceKm} كم</span>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <Navigation className="w-4 h-4" />
                <span>زمن النقل: {estimatedTime.travelTimeMinutes} دقيقة</span>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>وقت التحضير:</span>
                <span className="font-medium">{estimatedTime.preparationTimeMinutes} دقيقة</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>وقت التوصيل:</span>
                <span className="font-medium">{estimatedTime.travelTimeMinutes} دقيقة</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>وقت إضافي:</span>
                <span className="font-medium">{estimatedTime.bufferTimeMinutes} دقيقة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-gray-600">
          <strong>ملاحظة:</strong> الوقت المتوقع تقريبي ويعتمد على حركة المرور والظروف الجوية
        </p>
      </div>
    </div>
  );
}
