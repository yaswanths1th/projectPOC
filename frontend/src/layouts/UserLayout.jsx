// src/layouts/UserLayout.jsx
import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUser,
  FiLogOut,
  FiCpu
} from "react-icons/fi";
import "./UserLayout.css";

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="user-layout">

      {/* ✅ LEFT SIDEBAR */}
      <aside className="user-sidebar">
        <h2 className="sidebar-title">User Panel</h2>

        <ul className="sidebar-menu">
          <li className={location.pathname === "/dashboard" ? "active" : ""}>
            <Link to="/dashboard">
              <FiHome className="icon" /> Dashboard
            </Link>
          </li>

          <li className={location.pathname === "/profile" ? "active" : ""}>
            <Link to="/profile">
              <FiUser className="icon" /> Profile
            </Link>
          </li>

          {/* Plans */}
          <li className={location.pathname === "/account/plans" ? "active" : ""}>
            <Link to="/account/plans">
              <FiCpu className="icon" /> Plans
            </Link>
          </li>

          {/* AI link — show only if storedUser.subscription.can_use_ai is true */}
          {storedUser?.subscription?.can_use_ai && (
            <li className={location.pathname === "/account/ai" ? "active" : ""}>
              <Link to="/account/ai">
                <FiCpu className="icon" /> AI Chat
              </Link>
            </li>
          )}
        </ul>
      </aside>

      {/* ✅ CONTENT AREA */}
      <main className="user-content">
        <header className="user-header">
          <span className="header-user">
            Welcome, {storedUser?.username}
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
