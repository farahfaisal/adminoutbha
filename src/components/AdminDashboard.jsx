import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar/Sidebar';
import TopBar from './TopBar/TopBar';
import Overview from './Pages/Overview';
import Products from './Pages/Products';
import ProductsManagement from './Pages/ProductsManagement';
import VendorProductsManagement from './Pages/VendorProductsManagement';
import VendorProducts from './Pages/VendorProducts';
import ProductCatalogs from './Pages/ProductCatalogs';
import Categories from './Pages/Categories';
import VendorProductCategories from './Pages/VendorProductCategories';
import VendorsPage from './Pages/VendorsPage';
import AddVendor from './Pages/AddVendor';
import Drivers from './Pages/Drivers';
import AddDriver from './Pages/AddDriver';
import ShippingMethods from './Pages/ShippingMethods';
import DriverTrips from './Pages/DriverTrips';
import Customers from './Pages/Customers';
import AddCustomer from './Pages/AddCustomer';
import Users from './Pages/Users';
import Media from './Pages/Media';
import Wallet from './Pages/Wallet';
import WalletSettings from './Pages/WalletSettings';
import Notifications from './Pages/Notifications';
import Settings from './Pages/Settings';
import Advertisements from './Pages/Advertisements';
import PointsRewards from './Pages/PointsRewards';
import ReferralSystem from './Pages/ReferralSystem';
import Coupons from './Pages/Coupons';
import WholesaleCustomers from './Pages/WholesaleCustomers';
import Payments from './Pages/Payments';
import Ratings from './Pages/Ratings';
import RatingsReport from './Pages/RatingsReport';
import FinancialDashboard from './Pages/FinancialDashboard';
import ApiKeys from './Pages/ApiKeys';
import Orders from './Pages/Orders';
import ParcelOrders from './Pages/ParcelOrders';
import CaptainOrders from './Pages/CaptainOrders';
import Vendors from './Pages/Vendors';
import VendorCategoriesTable from './Pages/VendorCategoriesTable';
import UserReferralPage from './Pages/UserReferralPage';
import DriverTracking from './Pages/DriverTracking';
import { PaymentNotificationsList } from './PaymentNotifications';
import FirebaseNotifications from './Pages/FirebaseNotifications';
import ServiceAreas from './Pages/ServiceAreas';
import ServiceAreaManagers from './Pages/ServiceAreaManagers';
import DeliveryOffers from './Pages/DeliveryOffers';
import VendorStatistics from './Pages/VendorStatistics';
import VendorSettlementDetails from './Pages/VendorSettlementDetails';
import DriverStatistics from './Pages/DriverStatistics';
import DriverSettlementDetails from './Pages/DriverSettlementDetails';
import SecurityDashboard from './Pages/SecurityDashboard';
import AdminUsersManagement from './Pages/AdminUsersManagement';
import VendorLocations from './Pages/VendorLocations';
import NotificationSettings from './Pages/NotificationSettings';
import VendorDiscounts from './Pages/VendorDiscounts';
import CustomerMessages from './Pages/CustomerMessages';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';
import { usePendingOrderNotifications } from '../hooks/usePendingOrderNotifications';
import PendingOrdersAlert from './PendingOrdersAlert';
import ErrorBoundary from './ErrorBoundary';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('overview');

  const { totalPendingOrders, activateAudio, audioInitialized } = usePendingOrderNotifications({ enabled: true });

  // Auto-activate audio immediately and silently (once only)
  useEffect(() => {
    if (audioInitialized) return;

    let hasAttempted = false;

    const attemptActivation = async () => {
      if (hasAttempted) return;
      hasAttempted = true;

      try {
        await activateAudio();
        console.log('🔊 Audio activated');
      } catch (err) {
        // Silent - will retry on user interaction
      }
    };

    attemptActivation();

    // Set up activation on ANY user interaction (one time only)
    const activateOnInteraction = () => {
      if (!hasAttempted) {
        activateAudio();
        hasAttempted = true;
      }
    };

    const events = ['click', 'keydown', 'touchstart', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, activateOnInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, activateOnInteraction);
      });
    };
  }, [audioInitialized, activateAudio]);

  // Update document title when settings change
  useEffect(() => {
    try {
      document.title = `${settings?.store?.name || 'اطلبها'}`;
    } catch (error) {
      console.error('Error updating document title:', error);
      document.title = 'اطلبها';
    }
  }, [settings?.store?.name]);

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (path && path !== 'admin-dashboard') {
      setActiveTab(path);
    } else {
      // Default to overview if we're at the root admin dashboard path
      setActiveTab('overview');
    }
  }, [location]);

  // Auto-process pending orders when auto-processing is enabled
  useEffect(() => {
    if (!settings?.orders?.autoProcessing) {
      return;
    }

    console.log('Auto-processing enabled, setting up subscriptions...');
    const targetStatus = 'processing';

    // Function to auto-process an order
    const autoProcessOrder = async (tableName, orderId) => {
      try {
        const { error } = await supabase
          .from(tableName)
          .update({
            status: targetStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (error) {
          console.error(`Error auto-processing order in ${tableName}:`, error);
        } else {
          console.log(`Auto-processed order ${orderId} in ${tableName} to status: ${targetStatus}`);
        }
      } catch (err) {
        console.error(`Error in autoProcessOrder for ${tableName}:`, err);
      }
    };

    // Subscribe to regular orders (INSERT and UPDATE)
    const ordersSubscription = supabase
      .channel('auto-process-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('New pending order detected:', payload.new.id);
          autoProcessOrder('orders', payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('Order updated to pending:', payload.new.id);
          autoProcessOrder('orders', payload.new.id);
        }
      )
      .subscribe();

    // Subscribe to captain orders (INSERT and UPDATE)
    const captainOrdersSubscription = supabase
      .channel('auto-process-captain-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'captain_orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('New pending captain order detected:', payload.new.id);
          autoProcessOrder('captain_orders', payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captain_orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('Captain order updated to pending:', payload.new.id);
          autoProcessOrder('captain_orders', payload.new.id);
        }
      )
      .subscribe();

    // Subscribe to parcel orders (INSERT and UPDATE)
    const parcelOrdersSubscription = supabase
      .channel('auto-process-parcel-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'parcel_orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('New pending parcel order detected:', payload.new.id);
          autoProcessOrder('parcel_orders', payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parcel_orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('Parcel order updated to pending:', payload.new.id);
          autoProcessOrder('parcel_orders', payload.new.id);
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount or when auto-processing is disabled
    return () => {
      console.log('Cleaning up auto-processing subscriptions');
      ordersSubscription.unsubscribe();
      captainOrdersSubscription.unsubscribe();
      parcelOrdersSubscription.unsubscribe();
    };
  }, [settings?.orders?.autoProcessing]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/admin-dashboard/${tab}`);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 flex font-sans overflow-x-hidden w-full">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex-1 md:mr-64 max-w-full md:max-w-[calc(100vw-16rem)]">
          <TopBar />
          <PendingOrdersAlert
            totalPendingOrders={totalPendingOrders}
            onActivate={activateAudio}
          />
          <main className="p-4 md:p-6 space-y-6 overflow-x-hidden pt-20 md:pt-6">
            <Routes>
            <Route path="/" element={<Navigate to="/admin-dashboard/orders" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products-management" element={<ProductsManagement />} />
            <Route path="/vendor-products-management" element={<VendorProductsManagement />} />
            <Route path="/vendor-products/:vendorId" element={<VendorProducts />} />
            <Route path="/product-catalogs" element={<ProductCatalogs />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/vendor-product-categories" element={<VendorProductCategories />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors-list" element={<Vendors />} />
            <Route path="/add-vendor" element={<AddVendor />} />
            <Route path="/vendor-categories-table" element={<VendorCategoriesTable />} />
            <Route path="/vendor-locations" element={<VendorLocations />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/driver-trips" element={<DriverTrips />} />
            <Route path="/add-driver" element={<AddDriver />} />
            <Route path="/shipping-methods" element={<ShippingMethods />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/add-customer" element={<AddCustomer />} />
            <Route path="/users" element={<Users />} />
            <Route path="/media" element={<Media />} />
            <Route path="/points-rewards" element={<PointsRewards />} />
            <Route path="/referral" element={<ReferralSystem />} />
            <Route path="/user-referral" element={<UserReferralPage />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet-settings" element={<WalletSettings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/advertisements" element={<Advertisements />} />
            <Route path="/wholesale" element={<WholesaleCustomers />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/vendor-ratings" element={<Ratings type="vendor" />} />
            <Route path="/driver-ratings" element={<Ratings type="driver" />} />
            <Route path="/customer-ratings" element={<Ratings type="customer" />} />
            <Route path="/ratings-report" element={<RatingsReport />} />
            <Route path="/financial-dashboard" element={<FinancialDashboard />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/parcel-orders" element={<ParcelOrders />} />
            <Route path="/captain-orders" element={<CaptainOrders />} />
            <Route path="/driver-tracking" element={<DriverTracking />} />
            <Route path="/payment-notifications" element={<PaymentNotificationsList />} />
            <Route path="/firebase-notifications" element={<FirebaseNotifications />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/service-area-managers" element={<ServiceAreaManagers />} />
            <Route path="/delivery-offers" element={<DeliveryOffers />} />
            <Route path="/vendor-discounts" element={<VendorDiscounts />} />
            <Route path="/vendor-statistics" element={<VendorStatistics />} />
            <Route path="/vendor-settlement/:vendorId" element={<VendorSettlementDetails />} />
            <Route path="/driver-statistics" element={<DriverStatistics />} />
            <Route path="/driver-settlement/:driverId" element={<DriverSettlementDetails />} />
            <Route path="/security" element={<SecurityDashboard />} />
            <Route path="/admin-users" element={<AdminUsersManagement />} />
            <Route path="/customer-messages" element={<CustomerMessages />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
}