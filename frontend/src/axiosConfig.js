import axios from "axios";
import { API_URL } from "./config/api";

// Base backend URL
axios.defaults.baseURL = API_URL;

// Always attach token dynamically
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axios;
