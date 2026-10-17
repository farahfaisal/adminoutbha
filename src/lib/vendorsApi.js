import { supabase } from './supabase';

/**
 * الحصول على قائمة البائعين
 * @returns {Promise<Array>} - قائمة البائعين
 */
export const getVendors = async () => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vendors:', error);
    throw error;
  }
};

/**
 * الحصول على بائع محدد
 * @param {string} id - معرف البائع
 * @returns {Promise<Object>} - بيانات البائع
 */
const getVendor = async (id) => {
  try {
    // استخدام الدالة الجديدة للحصول على بيانات البائع
    const { data, error } = await supabase.rpc('get_vendor_details', {
      p_vendor_id: id
    });
    
    if (error) {
      console.error('Error using get_vendor_details RPC:', error);
      
      // محاولة استخدام الطريقة التقليدية كخطة بديلة
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select(`
          *,
          products(*)
        `)
        .eq('id', id)
        .single();
      
      if (vendorError) throw vendorError;
      return vendorData;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching vendor:', error);
    throw error;
  }
};

/**
 * تحديث بيانات بائع
 * @param {string} id - معرف البائع
 * @param {Object} vendorData - بيانات البائع المحدثة
 * @returns {Promise<Object>} - بيانات البائع المحدثة
 */
export const updateVendor = async (id, vendorData) => {
  try {
    // تحديث بيانات البائع
    const { data, error } = await supabase
      .from('vendors')
      .update({
        store_name: vendorData.store_name,
        phone: vendorData.phone,
        address: vendorData.address,
        description: vendorData.description,
        delivery_type: vendorData.delivery_type,
        delivery_radius: vendorData.delivery_radius,
        price_per_km: vendorData.price_per_km,
        min_delivery_fee: vendorData.min_delivery_fee,
        delivery_fee_per_km: vendorData.delivery_fee_per_km,
        estimated_delivery_time: vendorData.estimated_delivery_time,
        latitude: vendorData.latitude,
        longitude: vendorData.longitude,
        status: vendorData.status,
        logo_url: vendorData.logo_url,
        banner_url: vendorData.banner_url,
        commission_rate: vendorData.commission_rate,
        wallet_enabled: vendorData.wallet_enabled,
        auto_charge: vendorData.auto_charge,
        main_service_area_id: vendorData.main_service_area_id,
        service_areas: vendorData.service_areas,
        membership: vendorData.membership,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;

    // تحديث مناطق الخدمة إذا كانت موجودة
    if (vendorData.vendor_service_areas) {
      // حذف مناطق الخدمة القديمة
      await supabase
        .from('vendor_service_areas')
        .delete()
        .eq('vendor_id', id);

      // إضافة مناطق الخدمة الجديدة
      if (vendorData.vendor_service_areas.length > 0) {
        const serviceAreasData = vendorData.vendor_service_areas.map(area => ({
          vendor_id: id,
          service_area_id: area.service_area_id,
          custom_delivery_price: area.custom_delivery_price
        }));

        const { error: serviceAreasError } = await supabase
          .from('vendor_service_areas')
          .insert(serviceAreasData);

        if (serviceAreasError) {
          console.error('Error updating service areas:', serviceAreasError);
        }
      }
    }

    return data[0];
  } catch (error) {
    console.error('Error updating vendor:', error);
    throw error;
  }
};

/**
 * حذف بائع
 * @param {string} id - معرف البائع
 * @returns {Promise<boolean>} - نجاح العملية
 */
export const deleteVendor = async (id) => {
  try {
    // حذف البائع
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting vendor:', error);
    throw error;
  }
};

/**
 * تحديث حالة البائع
 * @param {string} id - معرف البائع
 * @param {string} status - الحالة الجديدة (active, inactive, busy, pending, suspended)
 * @returns {Promise<boolean>} - نجاح العملية
 */
const updateVendorStatus = async (id, status) => {
  try {
    // التحقق من صحة الحالة
    if (!['active', 'inactive', 'busy', 'pending', 'suspended'].includes(status)) {
      throw new Error('حالة غير صالحة');
    }
    
    // استخدام دالة RPC لتحديث حالة البائع
    const { data, error } = await supabase.rpc('update_vendor_status', {
      p_vendor_id: id,
      p_status: status
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating vendor status:', error);
    throw error;
  }
};

/**
 * ربط بائع بتصنيف
 * @param {string} vendorId - معرف البائع
 * @param {string} categoryId - معرف التصنيف
 * @returns {Promise<boolean>} - نجاح العملية
 */
const linkVendorToCategory = async (vendorId, categoryId) => {
  try {
    const { error } = await supabase
      .from('vendor_categories')
      .insert([{ vendor_id: vendorId, category_id: categoryId }]);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error linking vendor to category:', error);
    throw error;
  }
};

/**
 * إلغاء ربط بائع بتصنيف
 * @param {string} vendorId - معرف البائع
 * @param {string} categoryId - معرف التصنيف
 * @returns {Promise<boolean>} - نجاح العملية
 */
const unlinkVendorFromCategory = async (vendorId, categoryId) => {
  try {
    const { error } = await supabase
      .from('vendor_categories')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('category_id', categoryId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error unlinking vendor from category:', error);
    throw error;
  }
};

/**
 * الحصول على تصنيفات بائع
 * @param {string} vendorId - معرف البائع
 * @returns {Promise<Array>} - قائمة التصنيفات
 */
const getVendorCategories = async (vendorId) => {
  try {
    const { data, error } = await supabase
      .from('vendor_categories')
      .select(`
        category:category_id(*)
      `)
      .eq('vendor_id', vendorId);
    
    if (error) throw error;
    return data.map(item => item.category) || [];
  } catch (error) {
    console.error('Error fetching vendor categories:', error);
    throw error;
  }
};

