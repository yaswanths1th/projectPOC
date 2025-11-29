// ===============================================
// 🔐 SECURE PROTECTED ROUTE
// Uses cookie-based authentication
//
// Changes:
// ❌ OLD: Check localStorage token
// ✅ NEW: Call /api/auth/profile/ to verify session
// ===============================================

import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProfile } from "../api/auth";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      try {
        // 🔐 Call profile API
        // This will:
        // - Check if cookies exist
        // - Verify JWT in cookie
        // - Return user data if valid
        const response = await getProfile();

        if (response.ok && response.data) {
          setIsValid(true);
        } else {
          setIsValid(false);
        }
      } catch (error) {
        console.warn("Session validation failed:", error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, []);

  // Still validating
  if (isValidating) {
    return <div>Loading...</div>;
  }

  // Invalid session → redirect to login
  if (!isValid) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Valid session → allow access
  return children;
}

export default ProtectedRoute;

