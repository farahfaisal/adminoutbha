import { supabase } from './supabase';

/**
 * الحصول على قائمة المنتجات
 * @param {Object} options - خيارات الفلترة
 * @returns {Promise<Array>} - قائمة المنتجات
 */
export const getProducts = async (options = {}) => {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_id(store_name),
        category:category_id(name)
      `);
    
    // تطبيق الفلاتر
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.vendorId) {
      query = query.eq('vendor_id', options.vendorId);
    }
    
    if (options.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }
    
    if (options.search) {
      query = query.ilike('name', `%${options.search}%`);
    }
    
    // ترتيب النتائج
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * الحصول على منتج محدد
 * @param {string} id - معرف المنتج
 * @returns {Promise<Object>} - بيانات المنتج
 */
const getProduct = async (id) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_id(store_name),
        category:category_id(name),
        product_addons(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

/**
 * الحصول على منتجات بائع معين
 * @param {string} vendorId - معرف البائع
 * @param {string} categoryId - معرف التصنيف (اختياري)
 * @returns {Promise<Array>} - قائمة المنتجات
 */
const getProductsByVendor = async (vendorId, categoryId = null) => {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_id(store_name),
        category:category_id(name)
      `)
      .eq('vendor_id', vendorId)
      .eq('status', 'active');
    
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor products:', error);
    throw error;
  }
};

/**
 * الحصول على منتجات تصنيف معين
 * @param {string} categoryId - معرف التصنيف
 * @returns {Promise<Array>} - قائمة المنتجات
 */
const getProductsByCategory = async (categoryId) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_id(store_name),
        category:category_id(name)
      `)
      .eq('category_id', categoryId)
      .eq('status', 'active');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching category products:', error);
    throw error;
  }
};

/**
 * إنشاء منتج جديد
 * @param {Object} productData - بيانات المنتج
 * @returns {Promise<Object>} - بيانات المنتج المنشأ
 */
const createProduct = async (productData) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * تحديث منتج
 * @param {string} id - معرف المنتج
 * @param {Object} productData - بيانات المنتج المحدثة
 * @returns {Promise<Object>} - بيانات المنتج المحدثة
 */
const updateProduct = async (id, productData) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

/**
 * حذف منتج
 * @param {string} id - معرف المنتج
 * @returns {Promise<boolean>} - نجاح العملية
 */
const deleteProduct = async (id) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

