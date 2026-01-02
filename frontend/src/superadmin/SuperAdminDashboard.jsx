import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./SuperAdminDashboard.css";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ----------------------------
  // Logout handler
  // ----------------------------
  const handleLogout = () => {
    localStorage.clear();       // remove token + user
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get("/api/auth/superadmin/stats/");
        setStats(res.data);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) return <div className="sa-loading">Loading dashboard...</div>;
  if (!stats) return <div className="sa-loading">No data</div>;

  return (
    <div className="sa-dashboard-container">
      {/* 🔝 Top Bar */}
      <div className="sa-top-bar">
        <div>
          <h1 className="sa-title">SuperAdmin Dashboard</h1>
          <p className="sa-subtitle">System overview and tenant performance</p>
        </div>

        <button className="sa-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* 📊 Stats */}
      <div className="sa-stats-grid">
        <div
          className="sa-card clickable"
          onClick={() => navigate("/superadmin/tenants")}
        >
          <h3>Total Tenants</h3>
          <p>{stats.total_tenants}</p>
        </div>

        <div
          className="sa-card clickable"
          onClick={() =>
            navigate("/superadmin/tenants", { state: { filter: "active" } })
          }
        >
          <h3>Active Tenants</h3>
          <p>{stats.active_tenants}</p>
        </div>

        <div
          className="sa-card clickable"
          onClick={() =>
            navigate("/superadmin/users", { state: { filter: "all" } })
          }
        >
          <h3>Total Users</h3>
          <p>{stats.total_users}</p>
        </div>

        <div
          className="sa-card clickable"
          onClick={() =>
            navigate("/superadmin/users", { state: { filter: "active" } })
          }
        >
          <h3>Active Users</h3>
          <p>{stats.active_users}</p>
        </div>

        <div
          className="sa-card clickable"
          onClick={() =>
            navigate("/superadmin/users", { state: { filter: "tenant_admins" } })
          }
        >
          <h3>Tenant Admins</h3>
          <p>{stats.tenant_admins}</p>
        </div>
      </div>
    </div>
  );
}
