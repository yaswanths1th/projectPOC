// frontend/src/admin/AdminDashboard.jsx

import React, { useEffect, useState } from "react";
import api from "../api/axios";
import "../layouts/AdminLayout.css";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    holdUsers: 0,
  });

  const [roleName, setRoleName] = useState("Admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    // Load role name from user stored after login
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setRoleName(userData.role_name || "Admin");

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      // Cookie-based request (DO NOT add Authorization headers)
      const res = await api.get("/api/auth/admin/stats/", {
        withCredentials: true,
      });

      const data = res.data;

      setStats({
        totalUsers: data.total_users,
        activeUsers: data.active_users,
        holdUsers: data.hold_users,
      });
    } catch (err) {
      console.error("Stats loading failed:", err);
      setError("Failed to load user stats");
    } finally {
      setLoading(false);
    }
  };

  const goToAll = () =>
    navigate("/admin/users", { state: { statusFilter: "All Status" } });

  const goToActive = () =>
    navigate("/admin/users", { state: { statusFilter: "Active" } });

  const goToHold = () =>
    navigate("/admin/users", { state: { statusFilter: "Inactive" } });

  return (
    <div className="admin-dashboard-container">
      <section className="welcome-section">
        <h1 className="welcome-text">Welcome to {roleName} Dashboard..!!</h1>
        <p className="subtitle">Manage your platform and settings</p>
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
              onClick={goToAll}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{stats.totalUsers}</h2>
                <p>Total Users</p>
              </div>
              <span className="badge orange">All</span>
            </div>

            <div
              className="stat-card green"
              onClick={goToActive}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{stats.activeUsers}</h2>
                <p>Active Users</p>
              </div>
              <span className="badge green">Active</span>
            </div>

            <div
              className="stat-card blue"
              onClick={goToHold}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{stats.holdUsers}</h2>
                <p>Hold Users</p>
              </div>
              <span className="badge blue">On Hold</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
