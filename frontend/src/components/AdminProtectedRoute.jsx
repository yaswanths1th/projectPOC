import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProfile } from "../api/auth";

function AdminProtectedRoute({ children }) {
  const [isValidating, setIsValidating] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const validateAdmin = async () => {
      try {
        // 🔐 FIXED: Using profile API with cookies instead of localStorage
        const response = await getProfile();
        if (response.ok && response.data) {
          const isAdminUser = response.data.is_admin || response.data.is_staff || response.data.is_superuser;
          setIsAdmin(isAdminUser);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAdmin();
  }, []);

  if (isValidating) return <div>Loading...</div>;

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default AdminProtectedRoute;
