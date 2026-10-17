import { supabase } from './supabase';

// Bucket names
export const BUCKETS = {
  PRODUCTS: 'products',
  VENDORS: 'vendors',
  PROFILES: 'profiles',
  ADVERTISEMENTS: 'advertisements',
  ADDONS: 'addons',
  GENERAL: 'general'
};

/**
 * Upload a file to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} bucket - The bucket name
 * @param {string} folder - The folder path within the bucket
 * @returns {Promise<{path: string, url: string}>} - The file path and public URL
 */
export const uploadFile = async (file, bucket = BUCKETS.GENERAL, folder = '') => {
  try {
    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

    // Create the full path
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    console.log('Uploading file:', { bucket, filePath, fileName });

    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      });

    if (error) {
      console.error('Supabase storage error:', error);
      throw new Error(`فشل رفع الملف: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('File uploaded successfully:', { path: data.path, url: publicUrl });

    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Delete a file from Supabase Storage
 * @param {string} path - The file path
 * @param {string} bucket - The bucket name
 * @returns {Promise<boolean>} - Success status
 */
const deleteFile = async (path, bucket = BUCKETS.GENERAL) => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * List files in a bucket/folder
 * @param {string} bucket - The bucket name
 * @param {string} folder - The folder path within the bucket
 * @returns {Promise<Array>} - Array of files
 */
const listFiles = async (bucket = BUCKETS.GENERAL, folder = '') => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
};

