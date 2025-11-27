import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();

  const [adminName, setAdminName] = useState("Admin");
  const [panelName, setPanelName] = useState("Admin");
  const [permissions, setPermissions] = useState([]);
  const [initial, setInitial] = useState("A");
  const [avatarColor, setAvatarColor] = useState("#0b2349");

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      navigate("/login");
      return;
    }

    // 🔥 READ USER FROM LOCALSTORAGE INSTEAD OF API
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    console.log("USER FROM STORAGE:", userData);

    // SET NAME
    const name =
      userData.username ||
      `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
      "Admin";

    setAdminName(name);

    // SET PANEL NAME FROM role_name
    setPanelName(userData.role_name || "Admin");

    // SET PERMISSIONS
    setPermissions(userData.permissions || []);

    // Avatar setup
    const first = name.charAt(0).toUpperCase();
    setInitial(first);
    setAvatarColor(generateColor(first));
  }, [navigate]);

  // Permission checker
  const has = (p) => permissions.includes(p);

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
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">

        {/* 🔥 DYNAMIC PANEL NAME */}
        <h2 className="sidebar-title">{panelName} Panel</h2>

        <nav className="sidebar-nav">
          {/* ALWAYS VISIBLE */}
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          {/* MANAGE USERS */}
          {has("view_manage_user") && (
  <NavLink
    to="/admin/users"
    className={({ isActive }) =>
      isActive ? "nav-link active" : "nav-link"
    }
  >
    <Users size={18} /> Manage Users
  </NavLink>
)}


          {/* REPORTS */}
          {has("view_reports") ? (
            <NavLink
              to="/admin/reports"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <BarChart2 size={18} /> Reports
            </NavLink>
          ) : null}

          {/* SETTINGS */}
          {has("view_settings") ||
          has("manage_roles") ||
          has("manage_departments") ? (
            <NavLink
              to="/admin/settings"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <Settings size={18} /> Settings
            </NavLink>
          ) : null}
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
