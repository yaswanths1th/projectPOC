import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Edit2, Trash2 } from "lucide-react";
import "./ManageUsers.css";

function ManageUsers() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("access");

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

  // Permission checker
  const checkPermission = useCallback(
    async (codename) => {
      try {
        const res = await axios.get(
          "http://127.0.0.1:8000/api/permissions/has_permission/",
          {
            params: { codename },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        return res.data?.has === true;
      } catch {
        return false;
      }
    },
    [token]
  );

  // Verify admin
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await axios.get("http://127.0.0.1:8000/api/auth/profile/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const d = res.data || {};
        const backendIsAdmin = Boolean(
          d.is_staff || d.is_superuser || d.is_admin
        );

        setIsAdmin(backendIsAdmin);
        setAuthChecked(true);

        if (!backendIsAdmin) navigate("/dashboard", { replace: true });
      } catch {
        localStorage.clear();
        navigate("/login", { replace: true });
      }
    };

    verifyUser();
  }, [token, navigate]);

  // Load permissions
  useEffect(() => {
    if (!authChecked || !isAdmin) return;

    let mounted = true;

    (async () => {
      const [pAdd, pEdit, pDelete, pExport, pViewUser] = await Promise.all([
        checkPermission("add_user"),
        checkPermission("edit_user"),
        checkPermission("delete_user"),
        checkPermission("export_users"),
        checkPermission("view_user"),
      ]);

      if (!mounted) return;

      setCanAdd(pAdd);
      setCanEdit(pEdit);
      setCanDelete(pDelete);
      setCanExport(pExport);
      setCanViewUser(pViewUser);
    })();

    return () => {
      mounted = false;
    };
  }, [authChecked, isAdmin, checkPermission]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`;
  };

  const loadRoles = useCallback(async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/auth/roles/");
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch {
      showToast("Failed loading roles", "error");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!canViewUser) {
      // User has NO view permission → show empty array (but keep UI visible)
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/api/auth/admin/users/",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const raw = Array.isArray(res.data) ? res.data : res.data.results || [];

      const formatted = raw.map((u) => {
        const roleObj = roles.find((r) => Number(r.id) === Number(u.role));

        return {
          id: u.id,
          username: u.username,
          email: u.email,
          role: roleObj ? roleObj.role_name : "—",
          status: u.is_active ? "Active" : "Inactive",
          dateJoined: formatDate(u.date_joined),
          address: {},
        };
      });

      setUsers(formatted);
    } catch {
      showToast("Failed loading users", "error");
    } finally {
      setLoading(false);
    }
  }, [roles, token, canViewUser]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    loadRoles();
  }, [authChecked, isAdmin, loadRoles]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    loadUsers();
  }, [authChecked, isAdmin, roles, loadUsers]);

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

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)) &&
      (statusFilter === "All Status" || u.status === statusFilter) &&
      (roleFilter === "All Roles" || u.role === roleFilter)
    );
  });

  const indexOfLast = currentPage * usersPerPage;
  const current = filtered.slice(indexOfLast - usersPerPage, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(filtered.length / usersPerPage));

  const handleEdit = (u) => navigate(`/admin/users/edit/${u.id}`);
  const handleAdd = () => navigate("/admin/users/add");

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await axios.delete(
        `http://127.0.0.1:8000/api/auth/admin/users/${userToDelete.id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) => prev.filter((x) => x.id !== userToDelete.id));
      showToast("User deleted successfully", "success");
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setShowConfirm(false);
      setUserToDelete(null);
    }
  };

  if (!authChecked) {
    return <div style={{ padding: 40 }}>Checking permissions...</div>;
  }

  if (!isAdmin) {
    return <div style={{ padding: 40 }}>Redirecting...</div>;
  }

  return (
    <div className="manage-users-container">
      <div className="page-header">
        <h2>User Management</h2>
        <p>View, edit and manage users</p>

        <div className="header-actions">
          {canExport && (
            <button className="export-btn" onClick={exportUsers}>
              Export
            </button>
          )}

          {canAdd && (
            <button className="add-btn" onClick={handleAdd}>
              + Add User
            </button>
          )}
        </div>
      </div>

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

        {/* STATUS: disabled if user can't view */}
        <select
          className={`filter-select ${!canViewUser ? "disabled-select" : ""}`}
          value={statusFilter}
          onChange={(e) => {
            if (!canViewUser) return;
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          disabled={!canViewUser}
          aria-disabled={!canViewUser}
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>

        {/* ROLE: disabled if user can't view */}
        <select
          className={`filter-select ${!canViewUser ? "disabled-select" : ""}`}
          value={roleFilter}
          onChange={(e) => {
            if (!canViewUser) return;
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
          disabled={!canViewUser}
          aria-disabled={!canViewUser}
        >
          <option>All Roles</option>
          {roles.map((r) => (
            <option key={r.id}>{r.role_name}</option>
          ))}
        </select>
      </div>

      {/* TABLE ALWAYS VISIBLE */}
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
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                Updating data...
              </td>
            </tr>
          ) : !canViewUser ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", color: "#b71c1c" }}>
                You don’t have permission to view users.
              </td>
            </tr>
          ) : current.length > 0 ? (
            current.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>
                  {/* role-badge: adds color/shade */}
                  <span
                    className={`role-badge ${String(u.role || "")
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                    title={u.role}
                  >
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${String(u.status || "").toLowerCase()}`}>
                    {u.status}
                  </span>
                </td>
                <td>{u.dateJoined}</td>

                <td>
                  {canEdit && (
                    <button
                      className="action-btn edit"
                      onClick={() => handleEdit(u)}
                    >
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
              <td colSpan="6" style={{ textAlign: "center" }}>
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* PAGINATION */}
      {!loading && canViewUser && filtered.length > usersPerPage && (
        <div className="pagination-controls">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
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

      {/* DELETE CONFIRM MODAL */}
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>
              Delete user <b>{userToDelete?.username}</b>?
            </p>

            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>

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
