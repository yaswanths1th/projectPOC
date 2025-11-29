import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import api from "../api/axios";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("Admin");
  const [initial, setInitial] = useState("A");
  const [avatarColor, setAvatarColor] = useState("#0b2349");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // 🔐 FIXED: Using secure api instance with cookies
        const res = await api.get("/auth/profile/");
        const data = res.data;

        const name =
          data.first_name || data.last_name
            ? `${data.first_name || ""} ${data.last_name || ""}`.trim()
            : data.username || "Admin";

        setAdminName(name);
        const first = name.charAt(0).toUpperCase();
        setInitial(first);
        setAvatarColor(generateColor(first));
      } catch (err) {
        console.error("Profile fetch error:", err);
        navigate("/login");
      }
    };

    fetchProfile();
  }, [navigate]);

  const generateColor = (char) => {
    const colors = [
      "#0b2349",
      "#F97316",
      "#1E88E5",
      "#43A047",
      "#9C27B0",
      "#E53935",
      "#00897B",
      "#6D4C41",
    ];
    const index = (char.charCodeAt(0) - 65) % colors.length;
    return colors[index];
  };

  const handleLogout = () => {
    // 🔐 FIXED: No localStorage token storage needed
    // Cookies are automatically cleared by backend logout endpoint
    navigate("/login");
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h2 className="sidebar-title">Admin Panel</h2>

        <nav className="sidebar-nav">
          <NavLink to="/admin/dashboard"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          <NavLink to="/admin/users"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <Users size={18} /> Manage Users
          </NavLink>

          <NavLink to="/admin/reports"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <BarChart2 size={18} /> Reports
          </NavLink>

          <NavLink to="/admin/settings"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <Settings size={18} /> Settings
          </NavLink>
        </nav>
      </aside>

      <div className="admin-main-wrapper">
        <header className="admin-header">
          <span className="header-title">Welcome, {adminName}</span>

          <div
            className="profile-box"
            onClick={() => navigate("/admin/profile")}
            style={{ cursor: "pointer" }}
          >
            <div className="avatar" style={{ backgroundColor: avatarColor }}>
              {initial}
            </div>

            <span className="profile-name">{adminName}</span>

            <button
              className="logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
