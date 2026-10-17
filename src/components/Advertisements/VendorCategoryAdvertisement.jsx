import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function VendorCategoryAdvertisement({ categoryId, className = '' }) {
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (categoryId) {
      fetchAdvertisement();
    }
  }, [categoryId]);

  const fetchAdvertisement = async () => {
    try {
      setLoading(true);
      
      // Get current date in ISO format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch active advertisements for the vendor category
      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          vendor:vendor_id(store_name)
        `)
        .eq('vendor_category_id', categoryId)
        .eq('position', 'vendor_category')
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('priority', { ascending: true })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setAd(data[0]);
        // Record view
        incrementAdView(data[0].id);
      } else {
        setAd(null);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error fetching vendor category advertisement:', error);
      setError('فشل في تحميل الإعلان');
      setAd(null);
    } finally {
      setLoading(false);
    }
  };

  const incrementAdView = async (adId) => {
    try {
      // Use RPC function to increment views
      await supabase.rpc('increment_advertisement_views', { p_ad_id: adId });
    } catch (error) {
      console.error('Error recording advertisement view:', error);
    }
  };

  const handleClick = async () => {
    // Record click when the banner is clicked
    if (ad?.id) {
      try {
        await supabase.rpc('increment_advertisement_clicks', { p_ad_id: ad.id });
      } catch (error) {
        console.error('Error recording advertisement click:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} style={{ aspectRatio: '16/5' }}></div>
    );
  }

  if (error || !ad) {
    return null;
  }

  const content = (
    <div 
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio: '16/5' }}
    >
      <img 
        src={ad.image_url} 
        alt={ad.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22800%22%20height%3D%22250%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22800%22%20height%3D%22250%22%20fill%3D%22%23e2e8f0%22%3E%3C%2Frect%3E%3Ctext%20x%3D%22400%22%20y%3D%22125%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20alignment-baseline%3D%22middle%22%20font-family%3D%22Arial%2C%20sans-serif%22%20fill%3D%22%2364748b%22%3E%D8%A5%D8%B9%D9%84%D8%A7%D9%86%3C%2Ftext%3E%3C%2Fsvg%3E';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col justify-end p-4">
        <h3 className="text-white text-xl font-bold">{ad.title}</h3>
        {ad.description && (
          <p className="text-white/90 text-sm mt-1">{ad.description}</p>
        )}
      </div>
      {ad.vendor?.store_name && (
        <div className="absolute top-2 left-2 bg-white/80 px-2 py-1 rounded text-xs">
          {ad.vendor.store_name}
        </div>
      )}
    </div>
  );

  // If there's a link, wrap the content in a Link component
  if (ad.link) {
    return (
      <Link to={ad.link} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  // Otherwise, just return the content
  return content;
}