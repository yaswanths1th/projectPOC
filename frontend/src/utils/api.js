// ✅ src/utils/api.js
import axios from "axios";

// Backend URL from env; fallback to localhost
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ✅ Always attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ✅ Auto refresh token if expired (401)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem("refresh");

      if (!refresh) {
        localStorage.clear();
        window.location.href = "/login";
        return;
      }

      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/token/refresh/`,
          { refresh }
        );

        localStorage.setItem("access", res.data.access);

        error.config.headers.Authorization = `Bearer ${res.data.access}`;
        return api(error.config);
      } catch (err) {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
