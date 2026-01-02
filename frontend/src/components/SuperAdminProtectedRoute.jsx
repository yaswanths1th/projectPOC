import { Navigate } from "react-router-dom";

export default function SuperAdminProtectedRoute({ children }) {
  const token = localStorage.getItem("access");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // No token? → redirect to login
  if (!token) return <Navigate to="/login" replace />;

  // Superadmin logic:
  // Backend sends → is_superadmin: true
  const isSuper = Boolean(user?.is_superadmin);

  if (!isSuper) {
  // Admin UI (Tenant admin OR Department admin)
  if (
    user?.is_tenant_admin ||
    user?.permissions?.includes("view_manage_user")
  ) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Normal user
  return <Navigate to="/dashboard" replace />;
}


  return children;
}
