import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useContext(UserContext);
  const token = localStorage.getItem("access");
  const location = useLocation();

  // Wait while UserContext loads profile
  if (loading) return null; // or loader spinner

  // Not logged in → redirect
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin-only route but user is not admin → block
  if (adminOnly && !user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
