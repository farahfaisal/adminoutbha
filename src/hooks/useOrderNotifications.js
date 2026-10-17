import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useOrderNotifications({ enabled = true, onNewOrder = null } = {}) {
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const lastCountRef = useRef(null);
  const channelRef = useRef(null);

  const fetchOrderCount = useCallback(async () => {
    if (!enabled) return;

    try {
      const { count, error } = await supabase
        .from('driver_waiting_list')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;

      if (lastCountRef.current !== null && count > lastCountRef.current) {
        setHasNewOrders(true);
        if (onNewOrder) {
          onNewOrder({ count, previousCount: lastCountRef.current });
        }
      }

      lastCountRef.current = count;
      setOrderCount(count);
    } catch (error) {
      console.error('Error fetching order count:', error);
    }
  }, [enabled, onNewOrder]);

  useEffect(() => {
    if (!enabled) return;

    fetchOrderCount();

    channelRef.current = supabase
      .channel('driver_waiting_list_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_waiting_list'
        },
        () => {
          fetchOrderCount();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, fetchOrderCount]);

  const clearNotification = useCallback(() => {
    setHasNewOrders(false);
  }, []);

  return {
    hasNewOrders,
    orderCount,
    clearNotification
  };
}
