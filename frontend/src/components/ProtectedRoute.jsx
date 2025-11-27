// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../context/UserContext";

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(UserContext);

  if (loading) return null; // show nothing until profile loaded

  if (!user) return <Navigate to="/login" replace />;

  return children;
}

export default ProtectedRoute;
