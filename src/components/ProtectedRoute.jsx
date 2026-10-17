import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, loading, getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated()) {
    // Redirect to login page
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // If roles are specified, check if user has the required role
  const userToCheck = user || currentUser;
  if (allowedRoles.length > 0 && userToCheck && !allowedRoles.includes(userToCheck.role)) {
    // Redirect to appropriate dashboard based on role
    if (userToCheck.role === 'admin' || userToCheck.role === 'service_area_manager') {
      return <Navigate to="/admin-dashboard" />;
    }

    // Fallback
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  return children;
}