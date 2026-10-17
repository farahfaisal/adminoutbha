import { supabase } from './supabase';

export const getProductCatalogs = async () => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching product catalogs:', error);
    throw error;
  }
};

export const getActiveCatalogs = async () => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active catalogs:', error);
    throw error;
  }
};

export const getCatalogById = async (catalogId) => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .select('*')
      .eq('id', catalogId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching catalog:', error);
    throw error;
  }
};

export const createCatalog = async (catalogData) => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .insert([catalogData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating catalog:', error);
    throw error;
  }
};

export const updateCatalog = async (catalogId, updates) => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating catalog:', error);
    throw error;
  }
};

export const deleteCatalog = async (catalogId) => {
  try {
    const { error } = await supabase
      .from('product_catalogs')
      .delete()
      .eq('id', catalogId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting catalog:', error);
    throw error;
  }
};

export const getCatalogItems = async (catalogId) => {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    throw error;
  }
};

export const getActiveCatalogItems = async (catalogId) => {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('catalog_id', catalogId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active catalog items:', error);
    throw error;
  }
};

export const createCatalogItem = async (itemData) => {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .insert([itemData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating catalog item:', error);
    throw error;
  }
};

export const updateCatalogItem = async (itemId, updates) => {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating catalog item:', error);
    throw error;
  }
};

export const deleteCatalogItem = async (itemId) => {
  try {
    const { error } = await supabase
      .from('catalog_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting catalog item:', error);
    throw error;
  }
};

export const importCatalogItemToVendor = async (catalogItemId, vendorId, customPrice = null) => {
  try {
    const { data: catalogItem, error: fetchError } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('id', catalogItemId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!catalogItem) throw new Error('Catalog item not found');

    const productData = {
      vendor_id: vendorId,
      name: catalogItem.name,
      name_en: catalogItem.name_en,
      description: catalogItem.description,
      price: customPrice !== null ? customPrice : catalogItem.default_price,
      image_url: catalogItem.image_url,
      unit: catalogItem.unit,
      is_active: true,
      is_available: true
    };

    const { data: product, error: createError } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (createError) throw createError;

    if (catalogItem.variants && Array.isArray(catalogItem.variants) && catalogItem.variants.length > 0) {
      const variantsData = catalogItem.variants.map(variant => ({
        product_id: product.id,
        name: variant.name,
        price: variant.price
      }));

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsData);

      if (variantsError) console.error('Error creating variants:', variantsError);
    }

    if (catalogItem.addons && Array.isArray(catalogItem.addons) && catalogItem.addons.length > 0) {
      const addonsData = catalogItem.addons.map(addon => ({
        product_id: product.id,
        name: addon.name,
        price: addon.price,
        is_required: addon.is_required || false
      }));

      const { error: addonsError } = await supabase
        .from('product_addons')
        .insert(addonsData);

      if (addonsError) console.error('Error creating addons:', addonsError);
    }

    return product;
  } catch (error) {
    console.error('Error importing catalog item:', error);
    throw error;
  }
};

export const importMultipleCatalogItems = async (catalogItemIds, vendorId) => {
  try {
    const results = [];

    for (const itemId of catalogItemIds) {
      try {
        const product = await importCatalogItemToVendor(itemId, vendorId);
        results.push({ success: true, product });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Error importing multiple items:', error);
    throw error;
  }
};
