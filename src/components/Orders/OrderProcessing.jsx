import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { getOrderStatusHistory, updateOrderStatus, changeOrderDriver } from '../../lib/ordersApi';
import { mapStatusToAllowedValue, mapToOrderStatusHistoryValue, getDefaultStatusNote } from '../../utils/orderUtils';
import CustomerRatingForm from '../Rating/CustomerRatingForm';
import AddressMapModal from '../AddressMapModal';
import { formatDate } from '../../utils/formatters';
import PointsRedemptionForm from './PointsRedemptionForm';

/**
 * @typedef {Object} Driver
 * @property {string} id - Driver ID
 * @property {string} name - Driver name
 * @property {string} status - Driver status
 * @property {number} rating - Driver rating
 * @property {string} phone - Driver phone number
 */

/**
 * @typedef {Object} Order
 * @property {string} id - Order ID
 * @property {string} status - Order status
 * @property {number} total - Order total price
 * @property {string} customer_name - Customer name
 * @property {string} [customer_phone] - Customer phone
 * @property {string} vendor_name - Vendor/store name
 * @property {string} name - Product name
 * @property {number} price - Product price
 * @property {number} quantity - Product quantity
 * @property {string} address - Delivery address
 * @property {string} created_at - Order creation date
 * @property {string} [notes] - Order notes
 * @property {string} [payment_method] - Payment method
 */

/**
 * Order Processing Component
 * @param {Object} props - Component props
 * @param {Order} props.order - The order to process
 * @param {Function} props.onClose - Function to call when closing the component
 * @param {Function} props.onStatusUpdate - Function to call when order status is updated
 * @param {boolean} props.isModal - Whether the component is displayed as a modal
 */
export default function OrderProcessing({ order, onClose, onStatusUpdate, isModal = false }) {
  const [user, setUser] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [preparationTime, setPreparationTime] = useState(order.preparation_time || '');
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [statusHistory, setStatusHistory] = useState([]);
  const [showCustomerRating, setShowCustomerRating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [assigningToTrip, setAssigningToTrip] = useState(false);
  const [addingToWaitingList, setAddingToWaitingList] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(order.status);
  const [waitingListError, setWaitingListError] = useState(null);
  const [tripError, setTripError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [changingDriver, setChangingDriver] = useState(false);
  const [showChangeDriver, setShowChangeDriver] = useState(false);
  const [assignmentType, setAssignmentType] = useState('direct-trip');
  const [orderItems, setOrderItems] = useState([]);
  const [showAddressMap, setShowAddressMap] = useState(false);

  // Product addition states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);
  const [addingProduct, setAddingProduct] = useState(false);
  const [vendorFilter, setVendorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Address change states
  const [showChangeAddress, setShowChangeAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(order.address || '');
  const [changingAddress, setChangingAddress] = useState(false);

  // Points redemption states
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [orderPointsApplied, setOrderPointsApplied] = useState(order.points_applied || 0);
  const [orderPointsDiscount, setOrderPointsDiscount] = useState(order.points_discount || 0);

  // Coupon states
  const [couponData, setCouponData] = useState(null);

  const statusOptions = [
    { value: 'pending', label: 'معلق' },
    { value: 'accepted', label: 'مقبول' },
    { value: 'rejected', label: 'مرفوض' },
    { value: 'processing', label: 'قيد التحضير' },
    { value: 'waiting-for-driver', label: 'في قائمة الانتظار' },
    { value: 'delivered-to-driver', label: 'تم التسليم للسائق' },
    { value: 'delivering', label: 'جاري التوصيل' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
    { value: 'shipping', label: 'قيد الشحن' },
    { value: 'delivered', label: 'تم التوصيل' }
  ];

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        setUser(userData);
      }
    };

    getCurrentUser();
    loadDrivers();
    loadStatusHistory();
    fetchOrderItems();
    fetchProducts();
    fetchCouponData();
  }, []);

  const isAuthenticated = () => {
    return !!user;
  };

  const fetchCouponData = async () => {
    if (!order?.id) return;

    try {
      const { data, error } = await supabase
        .from('order_coupons')
        .select(`
          *,
          coupon:coupons(code, type, value)
        `)
        .eq('order_id', order.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching coupon data:', error);
        return;
      }

      if (data) {
        setCouponData(data);
      }
    } catch (err) {
      console.error('Error fetching coupon:', err);
    }
  };

  // حساب المبلغ الإجمالي الصحيح للطلب
  const calculateOrderTotal = () => {
    // حساب إجمالي المنتجات مع الإضافات من order_items.total
    const itemsTotal = orderItems.reduce((total, item) => {
      return total + parseFloat(item.total || 0);
    }, 0);

    const deliveryFee = parseFloat(order.delivery_fee || 0);
    return itemsTotal + deliveryFee;
  };

  const fetchOrderItems = async () => {
    if (!order?.id) return;

    try {
      // If this is a multi-vendor order with order_group_id, fetch all orders in the group
      let ordersToProcess = [order];

      if (order.is_multi_vendor && order.order_group_id) {
        const { data: groupOrders, error: groupError } = await supabase
          .from('orders')
          .select('*')
          .eq('order_group_id', order.order_group_id);

        if (groupError) {
          console.error('Error fetching group orders:', groupError);
        } else if (groupOrders && groupOrders.length > 0) {
          ordersToProcess = groupOrders;
        }
      }

      // Try to fetch from order_items table for all orders
      const allOrderIds = ordersToProcess.map(o => o.id);
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, quantity, price, total, vendor_id, vendor_name, name, notes, addons_data, product_name, variant_id, variant_name, product:products!order_items_product_id_fkey(id, name, price, image_url, preparation_time)')
        .in('order_id', allOrderIds);

      if (orderItemsError) {
        console.error('Error fetching order items:', orderItemsError);
      }

      // If no items in order_items table, check items_data field
      if (!orderItemsData || orderItemsData.length === 0) {
        let allFormattedItems = [];

        for (const currentOrder of ordersToProcess) {
          if (currentOrder.items_data && Array.isArray(currentOrder.items_data)) {
            // Get all product IDs to fetch vendor information
            const productIds = currentOrder.items_data
              .map(item => item.product_id)
              .filter(id => id);

            // Fetch product details including vendor information
            let productsMap = {};
            if (productIds.length > 0) {
              const { data: productsData } = await supabase
                .from('products')
                .select('id, name, vendor_id, vendors:vendor_id(id, name)')
                .in('id', productIds);

              if (productsData) {
                productsMap = productsData.reduce((acc, product) => {
                  acc[product.id] = product;
                  return acc;
                }, {});
              }
            }

            // Convert items_data to the same format as order_items
            const formattedItems = currentOrder.items_data.map((item, index) => {
              const product = productsMap[item.product_id];
              const vendor = product?.vendors;

              return {
                id: `temp-${currentOrder.id}-${index}`,
                order_id: currentOrder.id,
                product_id: item.product_id,
                product_name: item.product_name || item.name,
                name: item.product_name || item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
                variant_id: item.variant_id || null,
                variant_name: item.variant_name || null,
                addons_data: item.addons || [],
                vendor_id: product?.vendor_id || currentOrder.vendor_id,
                vendor_name: vendor?.name || currentOrder.vendor_name,
                product: product || null
              };
            });

            allFormattedItems.push(...formattedItems);
          }
        }

        setOrderItems(allFormattedItems);
        return;
      }

      setOrderItems(orderItemsData || []);

      // Set preparation time from the product with the longest preparation time if not already set
      if (orderItemsData && orderItemsData.length > 0 && !order.preparation_time) {
        const maxPrepTime = Math.max(...orderItemsData
          .filter(item => item.product?.preparation_time)
          .map(item => item.product.preparation_time || 0));

        if (maxPrepTime > 0) {
          setPreparationTime(maxPrepTime.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching order items:', error);
      toast.error('فشل في تحميل عناصر الطلب');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          stock,
          vendor_id,
          preparation_time,
          vendors:vendor_id (
            id,
            name
          )
        `)
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedProduct) {
      toast.error('الرجاء اختيار منتج');
      return;
    }
    
    if (productQuantity <= 0) {
      toast.error('الرجاء إدخال كمية صالحة');
      return;
    }
    
    try {
      setAddingProduct(true);
      
      const product = products.find(p => p.id === selectedProduct);
      
      if (!product) {
        toast.error('المنتج غير موجود');
        setAddingProduct(false);
        return;
      }
      
      // Add product to order items
      const itemTotal = product.price * productQuantity;
      const { data, error } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          product_id: product.id,
          quantity: productQuantity,
          price: product.price,
          total: itemTotal,
          product_name: product.name,
          vendor_id: order.vendor_id,
          vendor_name: order.vendor_name
        }])
        .select();
      
      if (error) {
        console.error('Error adding product to order:', error);
        toast.error('فشل في إضافة المنتج للطلب');
        setAddingProduct(false);
        return;
      }
      
      // Update order total and subtotal
      const additionalAmount = product.price * productQuantity;
      const newSubtotal = parseFloat(order.subtotal || 0) + additionalAmount;
      const newTotal = newSubtotal + parseFloat(order.delivery_fee || 0);

      // Update preparation time if needed
      let newPreparationTime = parseInt(preparationTime) || 0;
      if (product.preparation_time && product.preparation_time > newPreparationTime) {
        newPreparationTime = product.preparation_time;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          subtotal: newSubtotal,
          total: newTotal,
          preparation_time: newPreparationTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (updateError) {
        console.error('Error updating order total:', updateError);
        toast.error('فشل في تحديث إجمالي الطلب');
        setAddingProduct(false);
        return;
      }
      
      // Update preparation time in local state
      setPreparationTime(newPreparationTime.toString());
      
      toast.success('تمت إضافة المنتج للطلب بنجاح');
      
      // Refresh order items
      await fetchOrderItems();
      
      // Reset form
      setSelectedProduct('');
      setProductQuantity(1);
      setShowAddProduct(false);
      
      // Update the order total in local state
      if (onStatusUpdate) {
        onStatusUpdate(order.id, order.status, { 
          total: newTotal,
          preparation_time: newPreparationTime
        });
      }
    } catch (error) {
      console.error('Error adding product to order:', error);
      toast.error('حدث خطأ أثناء إضافة المنتج');
    } finally {
      setAddingProduct(false);
    }
  };

  const handleChangeAddress = async () => {
    if (!newAddress.trim()) {
      toast.error('الرجاء إدخال عنوان');
      return;
    }
    
    try {
      setChangingAddress(true);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          address: newAddress,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (error) {
        console.error('Error updating order address:', error);
        toast.error('فشل في تحديث عنوان التوصيل');
        setChangingAddress(false);
        return;
      }
      
      toast.success('تم تحديث عنوان التوصيل بنجاح');
      
      // Update local order address
      order.address = newAddress;
      
      // Close address form
      setShowChangeAddress(false);
      
      // Add status history record for address change
      await supabase
        .from('order_status_history')
        .insert([{
          order_id: order.id,
          status: order.status,
          note: 'تم تغيير عنوان التوصيل',
          created_by: user?.id
        }]);
        
      // Refresh status history
      loadStatusHistory();
      
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error('حدث خطأ أثناء تحديث العنوان');
    } finally {
      setChangingAddress(false);
    }
  };

  const assignDriverToTrip = async () => {
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    if (!selectedDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }

    try {
      setAssigningToTrip(true);
      setTripError(null);

      // Call the RPC function to assign trip to driver
      const { data, error } = await supabase.rpc(
        'assign_trip_to_driver',
        { 
          p_order_id: order.id,
          p_driver_id: selectedDriver.id
        }
      );

      if (error) throw error;

      // Update UI - no need to call handleUpdateStatus as the RPC function already handles it
      setOrderStatus('delivering');
      await loadStatusHistory();
      if (onStatusUpdate) {
        onStatusUpdate('delivering');
      }
      toast.success(`تم تعيين الرحلة للسائق ${selectedDriver.name}`);
    } catch (error) {
      console.error('Error assigning trip to driver:', error);
      toast.error('فشل في تعيين الرحلة للسائق');
      setTripError(error.message || 'فشل في تعيين الرحلة للسائق');
    } finally {
      setAssigningToTrip(false);
    }
  };

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, status, rating, phone')
        .order('name');

      if (error) throw error;

      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة السائقين');
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async () => {
    try {
      setLoadingHistory(true);
      const history = await getOrderStatusHistory(order.id);
      
      if (history && history.length > 0) {
        setStatusHistory(history.map(record => ({
          id: record.id,
          status: record.status,
          note: record.note || getDefaultStatusNote(record.status),
          created_at: record.created_at
        })));
      } else {
        setStatusHistory([
          { 
            id: 'initial', 
            status: order.status, 
            note: 'تم إنشاء الطلب', 
            created_at: order.created_at 
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading status history:', error);
      setStatusHistory([
        { 
          id: 'initial', 
          status: order.status, 
          note: 'تم إنشاء الطلب', 
          created_at: order.created_at 
        }
      ]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const addToWaitingList = async () => {
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    try {
      setAddingToWaitingList(true);
      setWaitingListError(null);

      // First check if vendor_id is directly available
      let vendorId = null;
      if (order.vendor_id) {
        console.log("Using direct vendor_id:", order.vendor_id);
        vendorId = order.vendor_id;
      } 
      // Then check if it's in the vendor object
      else if (order.vendor && order.vendor.id) {
        console.log("Using vendor.id:", order.vendor.id);
        vendorId = order.vendor.id;
      }
      // Finally try to get it by store name
      else {
        const vendorName = order.vendor_name || (order.vendor && order.vendor.store_name);

        if (!vendorName) {
          setWaitingListError('اسم المتجر غير متوفر');
          throw new Error('اسم المتجر غير متوفر');
        }

        try {
          // Try direct query first
          const { data: vendorData, error: vendorError } = await supabase
            .from('vendors')
            .select('id')
            .eq('store_name', vendorName)
            .maybeSingle();
          
          if (vendorError) throw vendorError;
          
          if (!vendorData) {
            // Try to find vendor using the lookup function
            const { data: lookupData, error: lookupError } = await supabase
              .rpc('find_vendor_by_name', { p_store_name: vendorName });
              
            if (lookupError) throw lookupError;
            
            if (lookupData) {
              vendorId = lookupData;
            } else {
              setWaitingListError('لم يتم العثور على المتجر');
              throw new Error('لم يتم العثور على المتجر');
            }
          } else {
            vendorId = vendorData.id;
          }
          
          console.log("Found vendor ID:", vendorId);
        } catch (error) {
          console.error('Error fetching vendor by name:', error);
          setWaitingListError(error.message || 'لم يتم العثور على معرف البائع');
          throw error;
        }
      }

      if (!vendorId) {
        setWaitingListError('لم يتم العثور على معرف البائع');
        throw new Error('لم يتم العثور على معرف البائع');
      }

      console.log("Adding to waiting list with vendor ID:", vendorId);

      // First check if order already exists in waiting list
      const { data: existingEntry } = await supabase
        .from('driver_waiting_list')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (existingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('driver_waiting_list')
          .update({
            vendor_id: vendorId,
            status: 'pending',
            customer_name: order.customer_name || '',
            address: order.address || '',
            total: order.total || 0,
            notes: order.notes || '',
            expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEntry.id);

        if (error) {
          console.error('Error updating waiting list entry:', error);
          setWaitingListError('فشل في تحديث قائمة الانتظار');
          throw error;
        }
        console.log('Updated existing waiting list entry');
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('driver_waiting_list')
          .insert([{
            order_id: order.id,
            vendor_id: vendorId,
            status: 'pending',
            customer_name: order.customer_name || '',
            address: order.address || '',
            total: order.total || 0,
            notes: order.notes || '',
            expires_at: new Date(Date.now() + 30 * 60000).toISOString()
          }]);

        if (error) {
          console.error('Error adding to waiting list:', error);
          setWaitingListError('فشل في إضافة الطلب لقائمة الانتظار');
          throw error;
        }
        console.log('Added new waiting list entry');
      }

      await handleUpdateStatus('waiting-for-driver', 'تم إضافة الطلب لقائمة انتظار السائقين');
      toast.success('تم إضافة الطلب لقائمة انتظار السائقين');
    } catch (error) {
      console.error('Error adding to waiting list:', error);
      toast.error(error.message || 'حدث خطأ أثناء إضافة الطلب لقائمة الانتظار');
      setWaitingListError(error.message || 'حدث خطأ أثناء إضافة الطلب لقائمة الانتظار');
    } finally {
      setAddingToWaitingList(false);
    }
  };

  const handleAssignDriver = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    if (assignmentType === 'direct-trip') {
      await assignDriverToTrip();
      return;
    } else if (assignmentType === 'waiting-list') {
      await addToWaitingList();
      return;
    }

    if (!selectedDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }
    
    try {
      setLoading(true);
      // Update the order status to processing first
      const { error: statusError } = await supabase
        .from('orders')
        .update({ status: 'processing' })
        .eq('id', order.id);
        
      if (statusError) throw statusError;
      
      // Then update the driver assignment
      await changeOrderDriver(
        order.id,
        selectedDriver.id,
        `تم تعيين السائق ${selectedDriver.name}`
      );
      
      setOrderStatus('delivered-to-driver');
      if (typeof onStatusUpdate === 'function') {
        onStatusUpdate(order.id, 'delivered-to-driver');
      }
      await loadStatusHistory();
      
      toast.success(`تم تعيين السائق ${selectedDriver.name} للطلب`);
      setLoading(false);
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('فشل في تعيين السائق');
      setLoading(false);
    }
  };

  const handleChangeDriver = async () => {
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    if (!selectedDriver) {
      toast.error('الرجاء اختيار سائق');
      return;
    }
    
    try {
      setChangingDriver(true);

      // Use the changeOrderDriver function from ordersApi
      await changeOrderDriver(
        order.id,
        selectedDriver.id,
        `تم تغيير السائق إلى ${selectedDriver.name}`
      );
      
      // Refresh status history
      await loadStatusHistory();
      
      toast.success(`تم تغيير السائق إلى ${selectedDriver.name}`);
      setShowChangeDriver(false);
    } catch (error) {
      console.error('Error changing driver:', error);
      toast.error('فشل في تغيير السائق');
    } finally {
      setChangingDriver(false);
    }
  };

  const handleUpdateStatus = async (newStatus, note = '') => {
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    try {
      setUpdatingStatus(true);

      // Update preparation time if changed
      if (preparationTime && preparationTime !== order.preparation_time) {
        await supabase
          .from('orders')
          .update({ preparation_time: parseInt(preparationTime) })
          .eq('id', order.id);
      }

      // Use updateOrderStatus API which handles both order update and history
      await updateOrderStatus(order.id, newStatus, note || statusNote || getDefaultStatusNote(newStatus));

      setOrderStatus(newStatus);
      if (typeof onStatusUpdate === 'function') {
        onStatusUpdate(order.id, newStatus, { preparation_time: preparationTime ? parseInt(preparationTime) : null });
      }
      await loadStatusHistory();
      setStatusNote('');
      toast.success('تم تحديث حالة الطلب');
      
      if (newStatus === 'completed') {
        setShowCustomerRating(true);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusUpdateClick = async () => {
    if (!isAuthenticated()) {
      toast.error('يرجى تسجيل الدخول للمتابعة');
      return;
    }

    try {
      setUpdatingStatus(true);
      await handleUpdateStatus(selectedStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handlePointsApplied = (pointsData) => {
    setOrderPointsApplied(pointsData.pointsUsed);
    setOrderPointsDiscount(pointsData.discountAmount);
    
    // Update the order object
    order.points_applied = pointsData.pointsUsed;
    order.points_discount = pointsData.discountAmount;
    order.total = pointsData.newTotal;
    order.redemption_code = pointsData.redemptionCode;
    
    // Notify parent component
    if (onStatusUpdate) {
      onStatusUpdate(order.id, order.status, {
        points_applied: pointsData.pointsUsed,
        points_discount: pointsData.discountAmount,
        total: pointsData.newTotal
      });
    }
    
    toast.success(`تم تطبيق ${pointsData.pointsUsed} نقطة وتوفير ${formatPrice(pointsData.discountAmount)}`);
  };

  const getStatusText = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'waiting-for-driver': return 'bg-orange-100 text-orange-800';
      case 'delivered-to-driver': return 'bg-purple-100 text-purple-800';
      case 'delivering': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'shipping': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAcceptOrder = () => {
    handleUpdateStatus('accepted', 'تم قبول الطلب');
    toast.success('تم قبول الطلب بنجاح');
  };

  const handleRejectOrder = () => {
    handleUpdateStatus('rejected', 'تم رفض الطلب');
    toast.error('تم رفض الطلب');
  };

  const handleProcessingOrder = () => {
    handleUpdateStatus('processing', 'الطلب قيد التحضير');
    toast.info('تم تحويل الطلب إلى قيد التحضير');
  };

  const handleCustomerRatingComplete = () => {
    toast.success('تم تقييم الزبون بنجاح');
    setShowCustomerRating(false);
  };

  // Format price
  const formatPrice = (price) => {
    if (!price) return '₪0.00';
    return `₪${parseFloat(price).toFixed(2)}`;
  };

  const extractCity = (address) => {
    const parts = address.split(',');
    return parts[0].trim() || 'غير محدد';
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl relative z-50 max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-2xl px-8 py-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">إجراءات الطلب</h2>
              <p className="text-blue-100 text-sm flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                  #{order.order_number || order.id?.substring(0, 8)}
                </span>
                <span className="text-white/80">•</span>
                <span>{formatDate(order.created_at)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 flex items-center justify-center backdrop-blur-sm group"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-8">{/* Content will follow */}

      {!isAuthenticated() ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">تنبيه!</strong>
          <span className="block sm:inline"> يرجى تسجيل الدخول للمتابعة.</span>
        </div>
      ) : showCustomerRating ? (
        <CustomerRatingForm 
          orderId={order.id}
          driverId={selectedDriver?.id || order.driver_id}
          customerId={order.customer_id}
          onComplete={handleCustomerRatingComplete}
        />
      ) : (
        <>
          {/* Points Redemption Modal */}
          {showPointsModal && order.customer_id && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowPointsModal(false)}>
              <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">استخدام النقاط</h3>
                  <button 
                    onClick={() => setShowPointsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <PointsRedemptionForm
                  orderId={order.id}
                  customerId={order.customer_id}
                  orderTotal={parseFloat(order.total)}
                  onPointsApplied={handlePointsApplied}
                  onClose={() => setShowPointsModal(false)}
                />
              </div>
            </div>
          )}

          {order.service_area && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6 mb-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span>منطقة الخدمة</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-emerald-100">
                      <p className="text-xs text-emerald-600 font-medium mb-1 uppercase">المنطقة</p>
                      <p className="font-bold text-gray-900 text-lg">{order.service_area.name}</p>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-teal-100">
                      <p className="text-xs text-teal-600 font-medium mb-1 uppercase">المدينة</p>
                      <p className="font-bold text-gray-900 text-lg">{order.service_area.city || order.customer_city || 'غير محدد'}</p>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-cyan-100">
                      <p className="text-xs text-cyan-600 font-medium mb-1 uppercase">رسوم التوصيل</p>
                      <p className="font-bold text-emerald-600 text-xl">{formatPrice(order.delivery_fee)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">بيانات الزبون</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">الاسم</p>
                    <p className="font-semibold text-gray-900">{order.customer_name || order.customer?.name || 'غير محدد'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">الهاتف</p>
                    <p className="font-semibold text-gray-900 dir-ltr text-right">{order.customer_phone || order.customer?.phone || 'غير محدد'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddressMap(true)}
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl w-full hover:bg-blue-100 transition-colors group"
                >
                  <svg className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-blue-600 mb-0.5 font-medium">العنوان</p>
                    <p className="font-semibold text-gray-900 text-sm">{order.address || 'غير محدد'}</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">بيانات المتجر</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">اسم المتجر</p>
                    <p className="font-semibold text-gray-900">{order.vendor_name || order.vendor?.store_name || 'غير معروف'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">هاتف المتجر</p>
                    <p className="font-semibold text-gray-900 dir-ltr text-right">{order.vendor?.phone || 'غير معروف'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">بيانات السائق</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">اسم السائق</p>
                    <p className="font-semibold text-gray-900">{order.driver_name || order.driver?.name || 'لم يتم تعيين سائق بعد'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">هاتف السائق</p>
                    <p className="font-semibold text-gray-900 dir-ltr text-right">{order.driver?.phone || 'غير متوفر'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">تفاصيل الطلب</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-xl">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">المبلغ الإجمالي</p>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-lg">{formatPrice(calculateOrderTotal())}</p>
                      {couponData && parseFloat(couponData.discount_amount) > 0 && (
                        <span className="text-xs text-gray-500 line-through">
                          {formatPrice(calculateOrderTotal() + parseFloat(couponData.discount_amount))}
                        </span>
                      )}
                    </div>
                    {couponData && parseFloat(couponData.discount_amount) > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs text-green-600 font-medium">{couponData.coupon?.code}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-xl">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">طريقة الدفع</p>
                    <p className="font-semibold text-slate-900">{order.payment_method || 'نقدي'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-xl">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">الحالة</p>
                    <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-lg ${getStatusColor(order.status)}`}>{getStatusText(order.status)}</span>
                  </div>
                </div>
                {orderPointsApplied > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs text-green-600 mb-0.5 font-medium">النقاط المستخدمة</p>
                      <p className="font-bold text-green-700">{orderPointsApplied} نقطة • خصم {formatPrice(orderPointsDiscount)}</p>
                    </div>
                  </div>
                )}
                {parseFloat(order.wallet_amount || 0) > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs text-blue-600 mb-0.5 font-medium">رصيد المحفظة المستخدم</p>
                      <p className="font-bold text-blue-700">{formatPrice(order.wallet_amount)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-300 shadow-sm">
                  <svg className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-amber-700 mb-2 font-bold">ملاحظات الطلب</p>
                    {order.notes && order.notes.trim() !== '' ? (
                      <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
                        <p className="font-semibold text-amber-900 text-base whitespace-pre-wrap leading-relaxed">{order.notes}</p>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">لا توجد ملاحظات لهذا الطلب</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">المنتجات المطلوبة</h4>
              </div>
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">إضافة منتج</span>
              </button>
            </div>

            <div className="space-y-3">
              {orderItems.length > 0 ? (
                orderItems.map((item, index) => (
                  <div key={index} className="group bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h5 className="font-bold text-gray-900 text-base leading-tight">
                            {item.product?.name || item.product_name || item.name || 'منتج غير معروف'}
                            <span className="inline-flex items-center gap-1 mr-2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold shadow-sm">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {item.quantity}x
                            </span>
                          </h5>
                          <div className="text-left flex-shrink-0">
                            {(() => {
                              const basePrice = item.price * item.quantity;
                              const addonsPrice = item.addons_data && Array.isArray(item.addons_data)
                                ? item.addons_data.reduce((sum, addon) => {
                                    const addonQty = addon.quantity || 1;
                                    const addonPrice = addon.price || 0;
                                    return sum + (addonQty * addonPrice);
                                  }, 0)
                                : 0;
                              const totalPrice = parseFloat(item.total || 0);

                              return (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">السعر الأصلي:</span>
                                    <span className="font-semibold text-gray-700 text-sm">{formatPrice(basePrice)}</span>
                                  </div>
                                  {addonsPrice > 0 && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-amber-600">+ الإضافات:</span>
                                        <span className="font-semibold text-amber-600 text-sm">{formatPrice(addonsPrice)}</span>
                                      </div>
                                      <div className="pt-1 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-emerald-700">المجموع:</span>
                                          <span className="font-bold text-emerald-600 text-lg">{formatPrice(totalPrice)}</span>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {addonsPrice === 0 && (
                                    <p className="font-bold text-emerald-600 text-lg">{formatPrice(totalPrice)}</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {item.vendor_name && (
                          <div className="mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                                <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                              </svg>
                              {item.vendor_name}
                            </span>
                          </div>
                        )}

                        {item.variant_name && (
                          <div className="mb-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              النوع: {item.variant_name}
                              <span className="mr-1 px-1.5 py-0.5 rounded-full bg-violet-600 text-white font-bold">
                                {item.quantity}x
                              </span>
                            </span>
                          </div>
                        )}

                        {item.addons_data && Array.isArray(item.addons_data) && item.addons_data.length > 0 && (
                          <div className="mb-2 p-3 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-lg border-2 border-amber-300 shadow-sm">
                            <div className="flex items-center justify-between mb-2.5">
                              <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </div>
                                الإضافات
                              </p>
                              <span className="text-xs font-bold text-amber-700 bg-white px-2.5 py-1 rounded-full border border-amber-300">
                                {item.addons_data.length} إضافة
                              </span>
                            </div>
                            <div className="space-y-2">
                              {item.addons_data.map((addon, i) => {
                                const addonName = addon.name || addon.addon_name;
                                const addonQty = addon.quantity || 1;
                                const addonPrice = addon.price || 0;
                                const addonTotal = addonQty * addonPrice;
                                return (
                                  <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{addonName}</p>
                                        <p className="text-xs text-gray-500">
                                          {formatPrice(addonPrice)} × {addonQty}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                                      {formatPrice(addonTotal)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {(() => {
                              const totalAddonsPrice = item.addons_data.reduce((sum, addon) => {
                                const addonQty = addon.quantity || 1;
                                const addonPrice = addon.price || 0;
                                return sum + (addonQty * addonPrice);
                              }, 0);
                              return (
                                <div className="mt-3 pt-3 border-t-2 border-dashed border-amber-300 flex items-center justify-between">
                                  <span className="text-sm font-semibold text-amber-800">إجمالي الإضافات:</span>
                                  <span className="text-base font-bold text-amber-700 bg-white px-3 py-1.5 rounded-lg border border-amber-300">
                                    {formatPrice(totalAddonsPrice)}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {item.notes && (
                          <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              ملاحظات المنتج:
                            </p>
                            <p className="text-xs text-blue-700">{item.notes}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700">{formatPrice(item.price)}</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700">الكمية: {item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">لا توجد منتجات في هذا الطلب</p>
                </div>
              )}

              <div className="mt-6 pt-6 border-t-2 border-dashed border-gray-300">
                {/* تحذير عند عدم وجود منتجات */}
                {orderItems.length === 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-800 mb-1">تنبيه: لا توجد منتجات في هذا الطلب</h4>
                        <p className="text-sm text-amber-700">
                          هذا الطلب لا يحتوي على أي منتجات. المبلغ المعروض هو رسوم التوصيل فقط.
                          يرجى إضافة منتجات للطلب أو حذف هذا الطلب إذا كان تم إنشاؤه بالخطأ.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                  {/* Price Breakdown */}
                  {(() => {
                    // حساب إجمالي المنتجات مع الإضافات من order_items.total
                    const itemsTotal = orderItems.reduce((total, item) => {
                      return total + parseFloat(item.total || 0);
                    }, 0);

                    const deliveryFee = parseFloat(order.delivery_fee || 0);
                    const finalTotal = calculateOrderTotal();

                    return (
                      <>
                        <div className="space-y-3 mb-4 pb-4 border-b border-emerald-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className={`flex items-center gap-2 ${orderItems.length === 0 ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                              إجمالي المنتجات مع الإضافات
                            </span>
                            <span className={`font-semibold ${orderItems.length === 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                              {formatPrice(itemsTotal)}
                              {orderItems.length === 0 && ' (بدون منتجات)'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                              </svg>
                              رسوم التوصيل
                            </span>
                            <span className="font-semibold text-emerald-600">
                              {formatPrice(deliveryFee)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm text-emerald-600 font-medium mb-0.5">المبلغ الإجمالي</p>
                              <p className="text-3xl font-bold text-emerald-700">{formatPrice(finalTotal)}</p>
                            </div>
                          </div>
                          {(orderPointsDiscount > 0 || couponData) && (
                            <div className="text-left space-y-2">
                              {couponData && parseFloat(couponData.discount_amount) > 0 && (
                                <div>
                                  <p className="text-sm text-gray-500 line-through mb-1">
                                    {formatPrice(parseFloat(order.total) + parseFloat(couponData.discount_amount))}
                                  </p>
                                  <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    كوبون {couponData.coupon?.code}: وفرت {formatPrice(couponData.discount_amount)}
                                  </p>
                                </div>
                              )}
                              {orderPointsDiscount > 0 && (
                                <div>
                                  {!couponData && (
                                    <p className="text-sm text-gray-500 line-through mb-1">
                                      {formatPrice(parseFloat(order.total) + parseFloat(orderPointsDiscount))}
                                    </p>
                                  )}
                                  <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    نقاط: وفرت {formatPrice(orderPointsDiscount)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {order.status === 'pending' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">قبول/رفض الطلب</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleAcceptOrder}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold group"
                  disabled={!isAuthenticated()}
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  قبول
                </button>
                <button
                  onClick={handleProcessingOrder}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 px-4 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold group"
                  disabled={!isAuthenticated()}
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  قيد التحضير
                </button>
                <button
                  onClick={handleRejectOrder}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white py-4 px-4 rounded-xl hover:from-red-700 hover:to-rose-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold group"
                  disabled={!isAuthenticated()}
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  رفض
                </button>
              </div>
            </div>
          )}

          {/* Points Redemption Section */}
          {order.customer_id && orderPointsApplied === 0 && ['pending', 'accepted'].includes(order.status) && (
            <div className="border rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">استخدام النقاط</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  يمكن للعميل استخدام نقاطه للحصول على خصم على هذا الطلب
                </p>
                <button
                  onClick={() => setShowPointsModal(true)}
                  disabled={!isAuthenticated()}
                  className={`w-full bg-purple-500 text-white py-2 rounded-md hover:bg-purple-600 transition-colors ${
                    !isAuthenticated() ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  تطبيق النقاط
                </button>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">وقت التحضير</h3>
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="5"
                max="120"
                value={preparationTime}
                onChange={(e) => setPreparationTime(e.target.value)}
                className="border rounded-md p-2 w-24"
              />
              <span>دقيقة</span>
            </div>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">تعيين سائق</h3>
            <div className="space-y-4">
              {order.driver_id ? (
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">السائق الحالي:</p>
                      <p className="text-lg">{order.driver_name || order.driver?.name || 'غير معروف'}</p>
                    </div>
                    <button
                      onClick={() => setShowChangeDriver(!showChangeDriver)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                    >
                      تغيير السائق
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio" 
                      value="direct-trip"
                      checked={assignmentType === 'direct-trip'}
                      onChange={(e) => setAssignmentType(e.target.value)}
                      className="ml-2"
                    />
                    تعيين رحلة مباشرة للسائق
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="waiting-list"
                      checked={assignmentType === 'waiting-list'}
                      onChange={(e) => setAssignmentType(e.target.value)}
                      className="ml-2"
                    />
                    إضافة لقائمة الانتظار
                  </label>
                </div>
              )}

              {(assignmentType === 'direct-trip' || showChangeDriver) && (
                <select
                  className="w-full border rounded-md p-2"
                  value={selectedDriver?.id || ''}
                  onChange={(e) => {
                    const driver = drivers.find(d => d.id === e.target.value);
                    setSelectedDriver(driver || null);
                  }}
                >
                  <option value="">اختر سائق</option>
                  {loading ? (
                    <option disabled>جاري تحميل السائقين...</option>
                  ) : (
                    drivers.map(driver => (
                      <option 
                        key={driver.id} 
                        value={driver.id}
                        disabled={driver.status === 'busy'}
                      >
                        {driver.name} ({driver.rating} ★) - {driver.status === 'available' ? 'متاح' : 'مشغول'}
                      </option>
                    ))
                  )}
                </select>
              )}
              
              {showChangeDriver ? (
                <button
                  onClick={handleChangeDriver}
                  disabled={!isAuthenticated() || changingDriver || !selectedDriver}
                  className={`w-full text-white py-2 rounded-md transition-colors ${
                    !isAuthenticated() || changingDriver || !selectedDriver
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {changingDriver ? 'جاري تغيير السائق...' : 'تغيير السائق'}
                </button>
              ) : !order.driver_id && (
                <button
                  onClick={handleAssignDriver} 
                  disabled={!isAuthenticated() || addingToWaitingList || assigningToTrip || 
                    ((assignmentType === 'direct-trip' && !selectedDriver) || orderStatus === 'delivered-to-driver')}
                  className={`w-full text-white py-2 rounded-md transition-colors ${
                    !isAuthenticated() || addingToWaitingList || assigningToTrip || 
                    ((assignmentType === 'direct-trip' && !selectedDriver) || orderStatus === 'delivered-to-driver')
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {assigningToTrip
                    ? 'جاري تعيين الرحلة...'
                    : addingToWaitingList 
                    ? 'جاري الإضافة...'
                    : orderStatus === 'delivered-to-driver'
                      ? 'تم تعيين السائق'
                      : assignmentType === 'direct-trip'
                        ? 'تعيين رحلة للسائق'
                        : assignmentType === 'waiting-list'
                        ? 'إضافة للقائمة'
                        : 'تعيين السائق'}
                </button>
              )}
              {waitingListError && (
                <p className="mt-2 text-sm text-red-600">{waitingListError}</p>
              )}
              {tripError && (
                <p className="mt-2 text-sm text-red-600">{tripError}</p>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">تحديث الحالة</h3>
            <div className="space-y-4">
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="ملاحظات (اختياري)"
                  className="w-full border rounded-md p-2"
                />
              </div>
              <button
                onClick={handleStatusUpdateClick}
                disabled={!isAuthenticated() || updatingStatus}
                className={`w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors ${
                  !isAuthenticated() || updatingStatus ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {updatingStatus ? 'جاري التحديث...' : 'تحديث الحالة'}
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">سجل الحالات</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((record) => (
                  <div key={record.id} className="flex items-center space-x-4 border-b pb-2">
                    <div className={`px-3 py-1 rounded-full ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </div>
                    <div className="text-gray-600">
                      {record.note}
                    </div>
                    <div className="text-gray-500 text-sm">
                      {new Date(record.created_at).toLocaleTimeString('en', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Product Modal */}
          {showAddProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowAddProduct(false)}>
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">إضافة منتج للطلب</h3>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setSearchQuery('');
                      setVendorFilter('all');
                      setSelectedProduct('');
                      setProductQuantity(1);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">البحث عن منتج</label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث بالاسم..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">فلترة حسب المتجر</label>
                      <select
                        value={vendorFilter}
                        onChange={(e) => setVendorFilter(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">جميع المتاجر</option>
                        {order.vendor_id && (
                          <option value={order.vendor_id}>المتجر الحالي ({order.vendor_name})</option>
                        )}
                        {Array.from(new Set(products.map(p => p.vendor_id)))
                          .filter(vendorId => vendorId !== order.vendor_id)
                          .map(vendorId => {
                            const vendor = products.find(p => p.vendor_id === vendorId)?.vendors;
                            return vendor ? (
                              <option key={vendorId} value={vendorId}>
                                {vendor.name}
                              </option>
                            ) : null;
                          })
                        }
                      </select>
                    </div>
                  </div>

                  {/* Products List */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المنتجات المتاحة ({
                        products.filter(product => {
                          const matchesSearch = searchQuery === '' ||
                            product.name.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesVendor = vendorFilter === 'all' ||
                            product.vendor_id === vendorFilter;
                          return matchesSearch && matchesVendor;
                        }).length
                      })
                    </label>
                    <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                      {products
                        .filter(product => {
                          const matchesSearch = searchQuery === '' ||
                            product.name.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesVendor = vendorFilter === 'all' ||
                            product.vendor_id === vendorFilter;
                          return matchesSearch && matchesVendor;
                        })
                        .map(product => (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProduct(product.id)}
                            className={`p-4 border-b cursor-pointer transition-all ${
                              selectedProduct === product.id
                                ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {product.vendors?.name || 'متجر غير معروف'}
                                  </span>
                                </p>
                                {product.stock && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    المخزون: {product.stock}
                                  </p>
                                )}
                              </div>
                              <div className="text-left mr-4">
                                <p className="text-lg font-bold text-green-600">
                                  {formatPrice(product.price)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      }
                      {products.filter(product => {
                        const matchesSearch = searchQuery === '' ||
                          product.name.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesVendor = vendorFilter === 'all' ||
                          product.vendor_id === vendorFilter;
                        return matchesSearch && matchesVendor;
                      }).length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          <p>لا توجد منتجات متاحة</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الكمية</label>
                    <input
                      type="number"
                      value={productQuantity}
                      onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="pt-4 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddProduct(false);
                        setSearchQuery('');
                        setVendorFilter('all');
                        setSelectedProduct('');
                        setProductQuantity(1);
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 ml-2 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      disabled={!selectedProduct || productQuantity < 1 || addingProduct}
                      className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                        !selectedProduct || productQuantity < 1 || addingProduct ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {addingProduct ? 'جاري الإضافة...' : 'إضافة المنتج'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Change Address Modal */}
          {showChangeAddress && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowChangeAddress(false)}>
              <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">تغيير عنوان التوصيل</h3>
                  <button 
                    onClick={() => setShowChangeAddress(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان الجديد</label>
                    <textarea 
                      value={newAddress} 
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full border rounded-md p-2"
                      rows="3"
                    />
                  </div>
                  
                  <div className="pt-4 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowChangeAddress(false)}
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 ml-2"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleChangeAddress}
                      disabled={!newAddress.trim() || changingAddress}
                      className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                        !newAddress.trim() || changingAddress ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {changingAddress ? 'جاري التحديث...' : 'تحديث العنوان'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Address Map Modal */}
          <AddressMapModal
            isOpen={showAddressMap}
            onClose={() => setShowAddressMap(false)}
            address={order.address}
            latitude={order.geocoded_latitude}
            longitude={order.geocoded_longitude}
          />
        </>
      )}
      </div>
    </div>
  );
}