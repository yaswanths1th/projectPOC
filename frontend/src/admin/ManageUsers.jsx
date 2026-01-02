// src/admin/ManageUsers.jsx
import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Edit2, Trash2 } from "lucide-react";
import "./ManageUsers.css";

function ManageUsers() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("access");
  const user = JSON.parse(localStorage.getItem("user")) || {};

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Permissions
  const [canAdd, setCanAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const [canViewUser, setCanViewUser] = useState(true);

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const initialStatusFilter = location.state?.statusFilter || "All Status";
  const updateMessage = location.state?.updateMessage;
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [showConfirm, setShowConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  const usersPerPage = 10;

  // Toast
  const showToast = (msg, type = "success") => {
    let wrapper = document.querySelector(".toast-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "toast-wrapper";
      document.body.appendChild(wrapper);
    }
    const t = document.createElement("div");
    t.className = `toast-message ${type}`;
    t.innerText = msg;
    wrapper.appendChild(t);
    setTimeout(() => (t.style.opacity = "0"), 1800);
    setTimeout(() => t.remove(), 2400);
  };

  // Read updateMessage
  useEffect(() => {
    if (updateMessage) {
      showToast(updateMessage, "success");
      navigate(location.pathname, { replace: true });
    }
  }, [updateMessage, navigate, location.pathname]);

  // Verify admin
  useEffect(() => {
const verifyUser = async () => {
  if (!token) {
    localStorage.clear();
    navigate("/login", { replace: true });
    return;
  }

  try {
    const res = await api.get("/api/auth/profile/");
    const d = res.data || {};

    const isSuper = d.is_superadmin === true;
    const isTenantAdmin = d.is_tenant_admin === true;
    const isDeptAdmin = d.is_department_admin === true;

    const perms = d.permissions || [];

    const isAllowedAdmin =
      isSuper ||
      isTenantAdmin ||
      isDeptAdmin ||
      perms.includes("view_manage_user");

    setIsAdmin(isAllowedAdmin);

    // ✅ FULL ACCESS ADMINS (GLOBAL OR DEPARTMENT)
    if (isSuper || isTenantAdmin || isDeptAdmin) {
      setCanViewUser(true);
      setCanAdd(true);
      setCanEdit(true);
      setCanDelete(true);
      setCanExport(true);
    } else {
      // ✅ Permission-based users
      setCanViewUser(
  perms.includes("view_manage_user") || perms.includes("view_user")
);

setCanAdd(
  perms.includes("add_user")
);

setCanEdit(
  perms.includes("edit_user")
);

setCanDelete(
  perms.includes("delete_user")
);

setCanExport(
  perms.includes("export_users")
);

    }

    // 🧠 Store department scope if needed later
    if (isDeptAdmin && d.department_id) {
      localStorage.setItem("admin_department_id", d.department_id);
    }

    setAuthChecked(true);
  } catch {
    localStorage.clear();
    navigate("/login", { replace: true });
  }
};


    verifyUser();
  }, [token, navigate]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`;
  };

  // Load roles (NO department filtering — backend already tenant-filters)
  const loadRoles = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/roles/");
      const all = Array.isArray(res.data) ? res.data : [];
      setRoles(all);
    } catch {
      showToast("Failed loading roles", "error");
    }
  }, []);

  

  // Load users (NO department filtering — backend handles tenant restriction)
  const loadUsers = useCallback(async () => {
    if (!canViewUser) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const res = await api.get("/api/auth/admin/users/");
      const raw = Array.isArray(res.data) ? res.data : res.data.results || [];

const formatted = raw.map((u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  role: u.role_name || "—",          // ✅ backend already sends this
  status: u.is_active ? "Active" : "Inactive",
  dateJoined: formatDate(u.date_joined),
}));

      setUsers(formatted);
    } catch {
      showToast("Failed loading users", "error");
    } finally {
      setLoading(false);
    }
  }, [canViewUser]);

  useEffect(() => {
    if (!authChecked) return;
    loadRoles();
  }, [authChecked, loadRoles]);

  useEffect(() => {
    if (!authChecked) return;
    loadUsers();
  }, [authChecked, roles, loadUsers]);

  // Export CSV
  const exportUsers = () => {
    if (!canExport) return;
    const headers = ["Username", "Email", "Role", "Status", "Joined"];
    const csvRows = [headers.join(",")];

    users.forEach((u) =>
      csvRows.push([u.username, u.email, u.role, u.status, u.dateJoined].join(","))
    );

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Users.csv";
    link.click();
  };

  // Filters
  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (statusFilter === "All Status" || u.status === statusFilter) &&
      (roleFilter === "All Roles" || u.role === roleFilter)
    );
  });

  const indexOfLast = currentPage * usersPerPage;
  const current = filtered.slice(indexOfLast - usersPerPage, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(filtered.length / usersPerPage));

  // Edit
  const handleEdit = (u) => navigate(`/admin/users/edit/${u.id}`);

  // Add
  const handleAdd = () => navigate("/admin/users/add");

  // Delete
  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/api/auth/admin/users/${userToDelete.id}/`);
      setUsers((prev) => prev.filter((x) => x.id !== userToDelete.id));
      showToast("User deleted successfully", "success");
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setShowConfirm(false);
      setUserToDelete(null);
    }
  };

  if (!authChecked) return <div style={{ padding: 40 }}>Checking permissions...</div>;
  if (!isAdmin) return <div style={{ padding: 40 }}>Redirecting...</div>;

  return (
    <div className="manage-users-container">
      <div className="page-header">
        <h2>User Management</h2>
        <p>View, edit and manage users</p>

        <div className="header-actions">
          {canExport && <button className="export-btn" onClick={exportUsers}>Export</button>}
          {canAdd && <button className="add-btn" onClick={handleAdd}>+ Add User</button>}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          className="filter-input search-box"
          placeholder="Search by username or email"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />

        <select
          className={`filter-select ${!canViewUser ? "disabled-select" : ""}`}
          value={statusFilter}
          onChange={(e) => {
            if (!canViewUser) return;
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          disabled={!canViewUser}
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>

        <select
          className={`filter-select ${!canViewUser ? "disabled-select" : ""}`}
          value={roleFilter}
          onChange={(e) => {
            if (!canViewUser) return;
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
          disabled={!canViewUser}
        >
          <option>All Roles</option>
          {roles.map((r) => (
            <option key={r.id}>{r.role_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <table className="users-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr><td colSpan="6" style={{ textAlign: "center" }}>Updating data...</td></tr>
          ) : !canViewUser ? (
            <tr><td colSpan="6" style={{ textAlign: "center", color: "#b71c1c" }}>You don't have permission to view users.</td></tr>
          ) : current.length > 0 ? (
            current.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-badge ${String(u.role).toLowerCase().replace(/\s+/g, "-")}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${String(u.status).toLowerCase()}`}>
                    {u.status}
                  </span>
                </td>
                <td>{u.dateJoined}</td>

                <td>
                  {canEdit && (
                    <button className="action-btn edit" onClick={() => handleEdit(u)}>
                      <Edit2 size={16} />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      className="action-btn delete"
                      onClick={() => {
                        setUserToDelete(u);
                        setShowConfirm(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  {!canEdit && !canDelete && <span className="no-access">No Access</span>}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>No users found</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {!loading && canViewUser && filtered.length > usersPerPage && (
        <div className="pagination-controls">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
            Prev
          </button>

          <span>
            Page {currentPage} / {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Confirm Delete */}
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>Delete user <b>{userToDelete?.username}</b>?</p>

            <button className="btn-btn-danger" onClick={handleDelete}>Delete</button>

            <button
              className="btn btn-gray"
              onClick={() => {
                setShowConfirm(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;
