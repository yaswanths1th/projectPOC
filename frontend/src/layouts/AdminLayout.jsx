import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Settings,
  LogOut,
  Menu,          // 🔹 hamburger icon
} from "lucide-react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();

  const [adminName, setAdminName] = useState("Admin");
  const [panelName, setPanelName] = useState("Admin");
  const [permissions, setPermissions] = useState([]);
  const [initial, setInitial] = useState("A");
  const [avatarColor, setAvatarColor] = useState("#0b2349");
  const [sidebarOpen, setSidebarOpen] = useState(false); // 🔹 for mobile drawer

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      navigate("/login");
      return;
    }

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    console.log("USER FROM STORAGE:", userData);

    const name =
      userData.username ||
      `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
      "Admin";

    setAdminName(name);
    setPanelName(userData.role_name || "Admin");
    setPermissions(userData.permissions || []);

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

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-layout">
      {/* 🔹 Backdrop for mobile */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
      />

      {/* 🔹 Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <h2 className="sidebar-title">{panelName} Panel</h2>

        <nav className="sidebar-nav">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
            onClick={closeSidebar}
          >
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          {has("view_manage_user") && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeSidebar}
            >
              <Users size={18} /> Manage Users
            </NavLink>
          )}

          {has("view_reports") && (
            <NavLink
              to="/admin/reports"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeSidebar}
            >
              <BarChart2 size={18} /> Reports
            </NavLink>
          )}

          {(has("view_settings") ||
            has("manage_roles") ||
            has("manage_departments")) && (
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeSidebar}
            >
              <Settings size={18} /> Settings
            </NavLink>
          )}
        </nav>
      </aside>

      {/* 🔹 Main wrapper */}
      <div className="admin-main-wrapper">
        <header className="admin-header">
          {/* Hamburger button (visible on mobile via CSS) */}
          <button
            className="header-menu-btn"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>

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
