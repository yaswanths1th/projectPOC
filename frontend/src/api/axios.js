// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true,    // 🔑 Enable cookies
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle silently — do not log browser red console
      return Promise.reject({ silent: true });
    }
    return Promise.reject(error);
  }
);

//  Remove token injection — no Authorization header needed now
export default api;
