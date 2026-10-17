import { supabase } from './supabase';

/**
 * Fetch basic ratings data
 */
async function getBasicRatings(type) {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('id, rating, comment, created_at, from_type, from_id, to_type, to_id')
      .eq('to_type', type)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching basic ratings:', error);
    throw error;
  }
}

/**
 * Helper function to fetch customer name
 */
async function getCustomerName(customerId) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching customer name:', error);
      return null;
    }

    return data?.name || null;
  } catch (error) {
    console.error('Error fetching customer name:', error);
    return null;
  }
}

/**
 * Helper function to fetch vendor store name
 */
async function getVendorStoreName(vendorId) {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('store_name')
      .eq('id', vendorId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching vendor store name:', error);
      return null;
    }

    return data?.store_name || null;
  } catch (error) {
    console.error('Error fetching vendor store name:', error);
    return null;
  }
}

/**
 * Helper function to fetch driver name
 */
async function getDriverName(driverId) {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('name')
      .eq('id', driverId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching driver name:', error);
      return null;
    }

    return data?.name || null;
  } catch (error) {
    console.error('Error fetching driver name:', error);
    return null;
  }
}

export async function getRatingsByType(type) {
  try {
    const basicRatings = await getBasicRatings(type);

    // Enrich the data with names
    const enrichedRatings = await Promise.all(
      basicRatings.map(async (rating) => {
        let fromName = null;
        let toName = null;

        if (rating.from_type === 'customer' && rating.from_id) {
          fromName = await getCustomerName(rating.from_id);
        } else if (rating.from_type === 'vendor' && rating.from_id) {
          fromName = await getVendorStoreName(rating.from_id);
        } else if (rating.from_type === 'driver' && rating.from_id) {
          fromName = await getDriverName(rating.from_id);
        }

        if (rating.to_type === 'customer' && rating.to_id) {
          toName = await getCustomerName(rating.to_id);
        } else if (rating.to_type === 'vendor' && rating.to_id) {
          toName = await getVendorStoreName(rating.to_id);
        } else if (rating.to_type === 'driver' && rating.to_id) {
          toName = await getDriverName(rating.to_id);
        }

        return {
          ...rating,
          from_name: fromName,
          to_name: toName,
        };
      })
    );

    return enrichedRatings;
  } catch (error) {
    console.error('Error fetching and enriching ratings:', error);
    throw error;
  }
}

export async function getRatingsStats(type) {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('to_type', type);

    if (error) throw error;

    // Calculate statistics
    const total = data.length;
    const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
    const average = total > 0 ? sum / total : 0;

    // Calculate distribution
    const distribution = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = data.filter(r => r.rating === i).length;
    }

    return {
      average,
      total,
      distribution
    };
  } catch (error) {
    console.error('Error fetching ratings stats:', error);
    throw error;
  }
}

export async function getRatingsReport(type, year) {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating, created_at')
      .eq('to_type', type)
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching ratings report:', error);
    throw error;
  }
}

export async function addRating(ratingData) {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .insert([ratingData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding rating:', error);
    throw error;
  }
}