import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VendorProvider } from './contexts/VendorContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import DriverLogin from './components/DriverLogin';
import ServiceAreaManagerLogin from './components/ServiceAreaManagerLogin';
import VendorLogin from './components/VendorLogin';
import VendorDashboard from './components/VendorDashboard';
import AdminDashboard from './components/AdminDashboard';
import PrivacyPolicy from './components/Pages/PrivacyPolicy';
import NotFound from './components/NotFound';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

// This component handles redirecting to the appropriate dashboard based on user role
function RoleBasedRedirect() {
  const location = useLocation();
  const { isAuthenticated, getCurrentUser } = useAuth();
  
  // If we're already on a specific route, don't redirect
  if (location.pathname !== '/') {
    return null;
  }
  
  // If user is authenticated, redirect to appropriate dashboard
  if (isAuthenticated()) {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'admin') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    // Add other role-based redirects here if needed
  }
  
  return (
    <Navigate to="/login" replace />
  );
}

function App() {
  return (
    <AuthProvider>
      <VendorProvider>
        <SettingsProvider>
          <Router>
            <div className="w-full overflow-x-hidden">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/driver-login" element={<DriverLogin />} />
                <Route path="/service-area-manager-login" element={<ServiceAreaManagerLogin />} />

                {/* Vendor Routes */}
                <Route path="/vendor/login" element={<VendorLogin />} />
                <Route path="/vendor/products" element={<VendorDashboard />} />

                {/* Admin Dashboard Routes */}
                <Route path="/admin-dashboard/*" element={
                  <ProtectedRoute allowedRoles={['admin', 'service_area_manager']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                {/* Public Pages */}
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                {/* Root path - redirect based on role */}
                <Route path="/" element={<RoleBasedRedirect />} />

                {/* Catch all route for 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>

              <ToastContainer
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
              />
            </div>
          </Router>
        </SettingsProvider>
      </VendorProvider>
    </AuthProvider>
  );
}

export default App;