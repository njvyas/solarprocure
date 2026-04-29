import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !can(permission[0], permission[1])) {
    return (
      <div style={{ padding:'2rem', color:'var(--color-text-danger)' }}>
        Access denied: requires {permission[0]}:{permission[1]}
      </div>
    );
  }

  return children;
}
