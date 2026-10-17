import { supabase } from './supabase';
import { calculateEstimatedDeliveryTime, canDeliver } from '../utils/deliveryTimeCalculator';

export const calculateDeliveryEstimate = async (vendorId, customerLat, customerLng) => {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('id, store_name, latitude, longitude, estimated_delivery_time, delivery_radius, delivery_type')
      .eq('id', vendorId)
      .single();

    if (error) throw error;

    if (!vendor.latitude || !vendor.longitude) {
      return {
        success: false,
        error: 'موقع المتجر غير محدد'
      };
    }

    if (!customerLat || !customerLng) {
      return {
        success: false,
        error: 'موقع العميل غير محدد'
      };
    }

    const canDeliverToAddress = canDeliver(
      vendor.latitude,
      vendor.longitude,
      customerLat,
      customerLng,
      vendor.delivery_radius || 50
    );

    if (!canDeliverToAddress && vendor.delivery_type === 'distance') {
      return {
        success: false,
        error: 'عذراً، هذا العنوان خارج نطاق التوصيل للمتجر'
      };
    }

    const estimate = calculateEstimatedDeliveryTime(
      vendor.latitude,
      vendor.longitude,
      customerLat,
      customerLng,
      {
        averageSpeedKmh: 30,
        preparationTimeMinutes: vendor.estimated_delivery_time || 20,
        bufferTimeMinutes: 5
      }
    );

    return {
      success: true,
      vendor: {
        id: vendor.id,
        name: vendor.store_name
      },
      estimate,
      canDeliver: canDeliverToAddress
    };
  } catch (error) {
    console.error('Error calculating delivery estimate:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء حساب وقت التوصيل'
    };
  }
};

export const getVendorsWithDeliveryEstimates = async (customerLat, customerLng, filters = {}) => {
  try {
    let query = supabase
      .from('vendors')
      .select('id, store_name, latitude, longitude, estimated_delivery_time, delivery_radius, delivery_type, logo_url, status')
      .eq('status', 'active');

    if (filters.categoryId) {
      const { data: vendorIds } = await supabase
        .from('vendor_categories')
        .select('vendor_id')
        .eq('category_id', filters.categoryId);

      if (vendorIds && vendorIds.length > 0) {
        query = query.in('id', vendorIds.map(v => v.vendor_id));
      }
    }

    const { data: vendors, error } = await query;

    if (error) throw error;

    const vendorsWithEstimates = vendors
      .filter(vendor => vendor.latitude && vendor.longitude)
      .map(vendor => {
        const estimate = calculateEstimatedDeliveryTime(
          vendor.latitude,
          vendor.longitude,
          customerLat,
          customerLng,
          {
            averageSpeedKmh: 30,
            preparationTimeMinutes: vendor.estimated_delivery_time || 20,
            bufferTimeMinutes: 5
          }
        );

        const canDeliverToAddress = canDeliver(
          vendor.latitude,
          vendor.longitude,
          customerLat,
          customerLng,
          vendor.delivery_radius || 50
        );

        return {
          ...vendor,
          estimate,
          canDeliver: canDeliverToAddress
        };
      })
      .filter(vendor => {
        if (filters.maxDistance) {
          return vendor.estimate.distanceKm <= filters.maxDistance;
        }
        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'distance') {
          return a.estimate.distanceKm - b.estimate.distanceKm;
        }
        if (filters.sortBy === 'time') {
          return a.estimate.totalTimeMinutes - b.estimate.totalTimeMinutes;
        }
        return 0;
      });

    return {
      success: true,
      vendors: vendorsWithEstimates
    };
  } catch (error) {
    console.error('Error fetching vendors with estimates:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء جلب المتاجر'
    };
  }
};

export const updateVendorLocation = async (vendorId, latitude, longitude) => {
  try {
    const { error } = await supabase
      .from('vendors')
      .update({
        latitude,
        longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', vendorId);

    if (error) throw error;

    return {
      success: true,
      message: 'تم تحديث موقع المتجر بنجاح'
    };
  } catch (error) {
    console.error('Error updating vendor location:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء تحديث الموقع'
    };
  }
};
