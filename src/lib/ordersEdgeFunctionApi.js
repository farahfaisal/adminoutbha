import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const createOrderViaEdgeFunction = async (orderData) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(orderData)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'فشل في إنشاء الطلب');
    }

    if (!result.success) {
      throw new Error(result.error || 'فشل في إنشاء الطلب');
    }

    return {
      success: true,
      order: result.order,
      message: result.message
    };
  } catch (error) {
    console.error('Error creating order via edge function:', error);
    throw error;
  }
};

export const createOrder = async ({
  customer_name,
  customer_phone,
  vendor_id,
  service_area_id,
  address,
  city,
  latitude,
  longitude,
  items,
  delivery_fee,
  payment_method = 'cash',
  wallet_amount = 0,
  coupon_discount = 0,
  points_discount = 0,
  notes,
  delivery_instructions,
  is_scheduled = false,
  scheduled_time
}) => {
  if (!customer_name || !customer_phone) {
    throw new Error('اسم الزبون ورقم الهاتف مطلوبان');
  }

  if (!vendor_id) {
    throw new Error('معرف المتجر مطلوب');
  }

  if (!service_area_id) {
    throw new Error('منطقة الخدمة مطلوبة');
  }

  if (!items || items.length === 0) {
    throw new Error('يجب إضافة منتج واحد على الأقل');
  }

  const orderData = {
    customer_name,
    customer_phone,
    vendor_id,
    service_area_id,
    address,
    city,
    items,
    delivery_fee: delivery_fee || 0,
    payment_method,
    wallet_amount: wallet_amount || 0,
    coupon_discount: coupon_discount || 0,
    points_discount: points_discount || 0,
    subtotal: 0,
    total: 0
  };

  if (latitude && longitude) {
    orderData.latitude = latitude;
    orderData.longitude = longitude;
  }

  if (notes) {
    orderData.notes = notes;
  }

  if (delivery_instructions) {
    orderData.delivery_instructions = delivery_instructions;
  }

  if (is_scheduled && scheduled_time) {
    orderData.is_scheduled = true;
    orderData.scheduled_time = scheduled_time;
  }

  return await createOrderViaEdgeFunction(orderData);
};

export const createSimpleOrder = async ({
  customerName,
  customerPhone,
  vendorId,
  serviceAreaId,
  address,
  city,
  productId,
  productName,
  quantity,
  price,
  deliveryFee,
  addons = []
}) => {
  const items = [
    {
      product_id: productId,
      product_name: productName,
      quantity: quantity,
      price: price,
      addons: addons
    }
  ];

  return await createOrder({
    customer_name: customerName,
    customer_phone: customerPhone,
    vendor_id: vendorId,
    service_area_id: serviceAreaId,
    address: address,
    city: city,
    items: items,
    delivery_fee: deliveryFee
  });
};
