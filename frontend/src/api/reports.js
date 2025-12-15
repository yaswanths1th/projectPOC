import axios from "axios";
import { API_URL } from "../config/api";

const API = axios.create({
  baseURL: `${API_URL}/api/`,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getAdminStats = () => API.get("auth/admin/stats/");
export const getUserGrowth = (days) =>
  API.get(`reports/admin/user-growth/?days=${days}`);
export const getRecentUsers = (days) =>
  API.get(`reports/admin/recent-users/?days=${days}`);
