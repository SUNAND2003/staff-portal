import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function AuthGuard({ children, role }) {
  const { isAuthenticated, user } = useAuthStore();

  // Not logged in → go to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Role-restricted routes (e.g. role="admin")
  if (role === 'admin') {
    if (!['admin', 'manager'].includes(user.role)) {
      // Employee tried to access admin route → send to their dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  // ✅ No role = just "must be logged in" — any role can pass
  return children;
}