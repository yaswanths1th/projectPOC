import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./SuperAdminLayout.css";

export default function SuperAdminLayout() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    isActive ? "sa-link active" : "sa-link";

  return (
    <div className="sa-layout">
      {/* Sidebar */}
      <aside className="sa-sidebar">
        <div className="sa-logo">SuperAdmin</div>

        <nav className="sa-nav">
          <NavLink to="/superadmin/dashboard" className={linkClass}>
            Dashboard
          </NavLink>

          <NavLink to="/superadmin/tenants" className={linkClass}>
            Tenants
          </NavLink>

          <NavLink to="/superadmin/users" className={linkClass}>
            Users
          </NavLink>

          {/* 🔥 NEW: Reports */}
          <NavLink to="/superadmin/reports" className={linkClass}>
            Reports
          </NavLink>
        </nav>

        <button className="sa-logout" onClick={logout}>
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="sa-content">
        <Outlet />
      </main>
    </div>
  );
}
