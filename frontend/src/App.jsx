// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AddressPage from "./pages/AddressPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ViewProfile from "./pages/ViewProfile";
import ChangePassword from "./pages/ChangePassword";
import EditProfilePage from "./pages/EditProfile";

import EditUserPage from "./admin/EditUserPage";
import AddUserPage from "./admin/AddUserPage";

import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import ManageUsers from "./admin/ManageUsers";
import Reports from "./admin/Reports";
import AdminSettings from "./admin/AdminSettings";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import UserLayout from "./layouts/UserLayout";

import PlansPage from "./pages/PlansPage";
import AIChat from "./pages/AIChat";
import BillingPage from "./pages/BillingPage";

import LandingPage from "./pages/LandingPage";
import AdminBillingPage from "./admin/AdminBillingPage";

import SuperAdminProtectedRoute from "./components/SuperAdminProtectedRoute";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import SuperAdminDashboard from "./superadmin/SuperAdminDashboard";
import TenantList from "./superadmin/TenantList";
import ManageAllUsers from "./superadmin/ManageAllUsers";
import SuperAdminReports from "./superadmin/SuperAdminReports";
import TenantReportPage from "./superadmin/TenantReportPage";

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  // Sync user across tabs / logout
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "user") {
        try {
          setUser(JSON.parse(e.newValue || "null"));
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // -----------------------------------------
  // DEFAULT ROUTE BASED ON USER TYPE
  // -----------------------------------------
  const getDefaultRoute = () => {
    if (!user) return "/login";

    if (user.is_superadmin) return "/superadmin/dashboard";

    if (
      user.is_tenant_admin ||
      user.permissions?.includes("view_manage_user")
    ) {
      return "/admin/dashboard";
    }

    return "/dashboard";
  };

  return (
    <>
      <ToastContainer />

      <Routes>
        {/* Root */}
        <Route
          path="/"
          element={user ? <Navigate to={getDefaultRoute()} /> : <LandingPage />}
        />

        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* ---------- USER ROUTES ---------- */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<ViewProfile />} />
          <Route path="addresses" element={<AddressPage />} />
          <Route
            path="edit-profile"
            element={<EditProfilePage isAdminRoute={false} />}
          />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="account/plans" element={<PlansPage />} />
          <Route path="account/ai" element={<AIChat />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>

        {/* ---------- ADMIN ROUTES ---------- */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="users/add" element={<AddUserPage />} />
          <Route path="users/edit/:id" element={<EditUserPage />} />
          <Route path="users/:userId" element={<ViewProfile />} />
          <Route path="profile" element={<ViewProfile />} />
          <Route
            path="profile/edit"
            element={<EditProfilePage isAdminRoute={true} />}
          />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* ---------- SUPERADMIN ROUTES ---------- */}
        <Route
          path="/superadmin"
          element={
            <SuperAdminProtectedRoute>
              <SuperAdminLayout />
            </SuperAdminProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="users" element={<ManageAllUsers />} />
          <Route path="reports" element={<SuperAdminReports />} />
          <Route path="reports/:tenantId" element={<TenantReportPage />} />
        </Route>

        {/* Admin billing */}
        <Route
          path="/admin/billing"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<AdminBillingPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={getDefaultRoute()} />} />
      </Routes>
    </>
  );
}

export default App;
