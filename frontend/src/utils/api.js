// 🔐 SECURE AXIOS INSTANCE
// Uses cookie-based authentication (same as api/axios.js)
// Tokens are NOT stored in localStorage

import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  // 🔐 Enable credentials (cookies) in all requests
  withCredentials: true,
});

// 🔐 Request interceptor
// Cookies are automatically sent by browser
// NO localStorage token needed
api.interceptors.request.use((config) => {
  // 🔐 Add CSRF token if available
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
  }

  return config;
});

// 🔐 Response interceptor
// Handle 401 (Unauthorized) and refresh tokens automatically
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        // Try to refresh token from cookie
        const refreshRes = await axios.post(
          "http://127.0.0.1:8000/api/auth/token/refresh/",
          {},
          { withCredentials: true }
        );

        if (refreshRes.ok) {
          // Backend set new access cookie
          // Retry original request
          return api(error.config);
        }
      } catch (err) {
        console.warn("Token refresh failed");
      }

      // Refresh failed → logout
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;

