import { Navigate } from "react-router-dom";

export default function AdminProtectedRoute({ children }) {
  const token = localStorage.getItem("access");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token) return <Navigate to="/login" replace />;

  const roleId = Number(user?.role_id);

  if (isNaN(roleId) || roleId === 2) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
