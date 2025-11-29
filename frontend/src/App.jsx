// =====================================================================
// App.jsx — FINAL FULL ROUTING FILE (Direct Login - No OTP)
// =====================================================================

import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Public pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword";

// User pages
import Dashboard from "./pages/Dashboard";
import AddressPage from "./pages/AddressPage";
import ViewProfile from "./pages/ViewProfile";
import ChangePassword from "./pages/ChangePassword";
import EditProfilePage from "./pages/EditProfile";

// Admin pages
import AdminDashboard from "./admin/AdminDashboard";
import ManageUsers from "./admin/ManageUsers";
import EditUserPage from "./admin/EditUserPage";
import AddUserPage from "./admin/AddUserPage";
import Reports from "./admin/Reports";
import AdminSettings from "./admin/AdminSettings";

// Layouts
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";

// Protected Routes
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

// Message loader
import { loadMessages } from "./utils/messageloader";

function App() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [msgsReady, setMsgsReady] = useState(false);

  // ======================================================
  // Load message tables
  // ======================================================
  useEffect(() => {
    const init = async () => {
      await loadMessages();
      setMsgsReady(true);
    };
    init();
  }, []);

  if (!msgsReady) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
        }}
      >
        Loading...
      </div>
    );
  }

  // ======================================================
  // DEFAULT REDIRECT BASED ON ROLE
  // ======================================================
  const getDefaultRoute = () => {
    if (!user) return "/login";

    const roleId = Number(user.role_id);

    // Admin
    if (!isNaN(roleId) && roleId !== 2) return "/admin/dashboard";

    // Normal user
    return "/dashboard";
  };

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getDefaultRoute()} />} />

      {/* ========================================================== */}
      {/* PUBLIC ROUTES */}
      {/* ========================================================== */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* ========================================================== */}
      {/* USER ROUTES (Protected) */}
      {/* ========================================================== */}
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
      </Route>

      {/* ========================================================== */}
      {/* ADMIN ROUTES (Protected) */}
      {/* ========================================================== */}
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

      {/* 404 → redirect */}
      <Route path="*" element={<Navigate to={getDefaultRoute()} />} />
    </Routes>
  );
}

export default App;
