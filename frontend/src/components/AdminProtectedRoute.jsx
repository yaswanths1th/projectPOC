// src/components/AdminProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../context/UserContext";

function AdminProtectedRoute({ children }) {
  const { user, loading } = useContext(UserContext);

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  return children;
}

export default AdminProtectedRoute;
