// src/layouts/UserLayout.jsx
import React, { useContext, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUser,
  FiLogOut,
  FiCpu,
  FiPackage,
  FiMenu,    // 🔹 for mobile hamburger
} from "react-icons/fi";

import "./UserLayout.css";
import { UserContext } from "../context/UserContext";

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const storedUser = user || JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Extract AI permission safely
  const canUseAI =
    storedUser?.subscription?.can_use_ai === true ||
    storedUser?.subscription?.features?.can_use_ai === true;

  return (
    <div className="user-layout">
      {/* BACKDROP for mobile */}
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
      />

      {/* LEFT SIDEBAR */}
      <aside className={`user-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <h2 className="sidebar-title">User Panel</h2>

        <ul className="sidebar-menu">
          <li className={location.pathname === "/dashboard" ? "active" : ""}>
            <Link to="/dashboard" onClick={closeSidebar}>
              <FiHome className="icon" /> Dashboard
            </Link>
          </li>

          <li className={location.pathname === "/profile" ? "active" : ""}>
            <Link to="/profile" onClick={closeSidebar}>
              <FiUser className="icon" /> Profile
            </Link>
          </li>

          <li
            className={
              location.pathname === "/account/plans" ? "active" : ""
            }
          >
            <Link to="/account/plans" onClick={closeSidebar}>
              <FiPackage className="icon" /> Plans
            </Link>
          </li>

          {canUseAI && (
            <li className={location.pathname === "/account/ai" ? "active" : ""}>
              <Link to="/account/ai" onClick={closeSidebar}>
                <FiCpu className="icon" /> AI Chat
              </Link>
            </li>
          )}
        </ul>
      </aside>

      {/* CONTENT AREA */}
      <main className="user-content">
        <header className="user-header">
          {/* Hamburger visible only on mobile via CSS */}
          <button
            className="header-menu-btn"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            <FiMenu size={22} />
          </button>

          <span className="header-user">
            Welcome, {storedUser?.username || "User"}
          </span>

          <button className="header-logout-btn" onClick={handleLogout}>
            <FiLogOut size={18} /> Logout
          </button>
        </header>

        <div className="user-page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
