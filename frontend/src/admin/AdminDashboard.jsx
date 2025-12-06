import React, { useEffect, useState } from "react";
import axios from "axios";
import "../layouts/AdminLayout.css";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config/api";


export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    holdUsers: 0,
  });

  const [roleName, setRoleName] = useState("Admin");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionMsg, setPermissionMsg] = useState("");

  const navigate = useNavigate();

  // ----------------------------------------------------
  // Get message from user_error table by code (EX001)
  // ----------------------------------------------------
  const getMessageByCode = (code) => {
    if (!code) return "";

    try {
      const ue = JSON.parse(localStorage.getItem("user_error") || "[]");

      const msg = ue.find(
        (m) => m?.error_code?.toUpperCase() === code.toUpperCase()
      );

      return msg?.error_message || code;
    } catch {
      return code;
    }
  };

  // Axios instance
  const API = axios.create({
    baseURL: `${API_URL}/api/`,
  });
  useEffect(() => {
  if (permissionMsg) {
    const timer = setTimeout(() => {
      setPermissionMsg("");
    }, 5000);

    return () => clearTimeout(timer);
  }
}, [permissionMsg]);


  // Token refresh interceptor
  API.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        localStorage.getItem("refresh")
      ) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem("refresh");
          const res = await axios.post(
            `${API_URL}/api/auth/token/refresh/`,
            { refresh: refreshToken }
          );

          localStorage.setItem("access", res.data.access);
          API.defaults.headers.common["Authorization"] = `Bearer ${res.data.access}`;
          originalRequest.headers["Authorization"] = `Bearer ${res.data.access}`;

          return API(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }

      return Promise.reject(error);
    }
  );

  // ----------------------------------------------------
  // On Load – Set role, permissions & stats
  // ----------------------------------------------------
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    setRoleName(userData.role_name || "Admin");
    setPermissions(userData.permissions || []);

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("access");

      const res = await API.get("auth/admin/stats/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;

      setStats({
        totalUsers: data.total_users,
        activeUsers: data.active_users,
        holdUsers: data.hold_users,
      });
    } catch {
      setError("Failed to load user stats");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Card click handler
  // ----------------------------------------------------
  const handleUserNavigation = (filter) => {
    if (!permissions.includes("view_manage_user")) {
      const errMsg = getMessageByCode("EX001");
      setPermissionMsg(errMsg);
      return;
    }

    navigate("/admin/users", { state: { statusFilter: filter } });
  };

  return (
    <div className="admin-dashboard-container">
      <section className="welcome-section">
        <h1 className="welcome-text">Welcome to {roleName} Dashboard..!!</h1>
        <p className="subtitle">Manage your platform.</p>
      </section>

      <section className="stats-section">
        <h3 className="section-title">User Overview</h3>

        {loading ? (
          <p className="loading-text">Loading data...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : (
          <div className="stats-cards">
            <div
              className="stat-card orange"
              onClick={() => handleUserNavigation("All Status")}
            >
              <div className="stat-info">
                <h2>{permissions.includes("view_manage_user") ? stats.totalUsers : "--"}</h2>
                <p>Total Users</p>
              </div>
              <span className="badge orange">All</span>
            </div>

            <div
              className="stat-card green"
              onClick={() => handleUserNavigation("Active")}
            >
              <div className="stat-info">
                <h2>{permissions.includes("view_manage_user") ? stats.activeUsers : "--"}</h2>
                <p>Active Users</p>
              </div>
              <span className="badge green">Active</span>
            </div>

            <div
              className="stat-card blue"
              onClick={() => handleUserNavigation("Inactive")}
            >
              <div className="stat-info">
                <h2>{permissions.includes("view_manage_user") ? stats.holdUsers : "--"}</h2>
                <p>Hold Users</p>
              </div>
              <span className="badge blue">On Hold</span>
            </div>
          </div>
        )}

        {permissionMsg && (
  <div style={{ textAlign: "center", marginTop: "20px" }}>
    <p className="error-text" style={{ display: "inline-block", marginTop: "15px" }}>
      {permissionMsg}
    </p>
  </div>
)}

      </section>
    </div>
  );
}
