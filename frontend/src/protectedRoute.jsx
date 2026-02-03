import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // While checking auth
  if (loading) {
    return <p>Checking authentication...</p>;
  }

  // If not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in → allow access
  return children;
}

export default ProtectedRoute;
