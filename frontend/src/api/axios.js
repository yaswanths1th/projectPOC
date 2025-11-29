// ===============================================
// 🔐 SECURE COOKIE-BASED AXIOS CONFIG
// ===============================================
// ✅ NEW: Cookies are handled automatically by browser
// ✅ NO localStorage tokens needed
// ✅ HttpOnly cookies prevent JavaScript access
// ===============================================

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  // 🔐 CRITICAL: Enable credentials (cookies) in all requests
  withCredentials: true,
});

// =====================================================================
// 🔐 SECURITY FIX #1
// Automatically send & receive cookies in ALL requests
// No Authorization header needed (browser handles cookies)
// =====================================================================
api.interceptors.request.use((config) => {
  // ✅ Cookies are automatically sent by browser with withCredentials: true
  // ❌ Do NOT add Bearer token header (cookie-based auth instead)
  // ❌ Do NOT read from localStorage

  // 🔐 Optional: Add CSRF token if needed (Django handles it)
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
  }

  return config;
});

// =====================================================================
// 🔐 SECURITY FIX #2
// Handle 401 (Unauthorized) responses
// =====================================================================
api.interceptors.response.use(
  (response) => response,

  (error) => {
    // Token invalid/expired or cookies cleared
    if (error.response && error.response.status === 401) {
      console.warn("🔐 Unauthorized — Session expired. Redirecting to login.");

      // 🔐 Clear any remaining tokens (shouldn't exist with cookies)
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      sessionStorage.removeItem("access");

      // Redirect to login
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;

