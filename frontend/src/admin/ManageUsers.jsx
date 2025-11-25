import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Edit2, Trash2 } from "lucide-react";
import "./ManageUsers.css";

function ManageUsers() {
  const navigate = useNavigate();
  const location = useLocation();

  // -------------------------
  // All states (declared up-front to keep Hook order stable)
  // -------------------------
  const token = localStorage.getItem("access");

  // Auth/admin verification
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Permissions
  const [canAdd, setCanAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canExport, setCanExport] = useState(false);

  // Data + UI states
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

  // -------------------------
  // Helper: Toast
  // -------------------------
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

  useEffect(() => {
    if (updateMessage) {
      showToast(updateMessage, "success");
      // remove state from location so message doesn't repeat
      navigate(location.pathname, { replace: true });
    }
  }, [updateMessage, navigate, location.pathname]);

  // -------------------------
  // Permission checker (uses token)
  // -------------------------
  const checkPermission = useCallback(
    async (codename) => {
      if (!token) return false;
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

  // -------------------------
  // Profile verification -> decide admin or redirect.
  // This effect runs once. It sets authChecked/isAdmin.
  // -------------------------
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        // no token -> go to login
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await axios.get("http://127.0.0.1:8000/api/auth/profile/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data || {};
        const backendIsAdmin = Boolean(
          data.is_staff || data.is_superuser || data.is_admin
        );

        setIsAdmin(backendIsAdmin);
        setAuthChecked(true);

        // don't navigate here — allow other effects to use isAdmin to fetch
        if (!backendIsAdmin) {
          // non-admin should not stay: redirect to user dashboard
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        // If tokens invalid -> clean and go to login
        localStorage.clear();
        navigate("/login", { replace: true });
      }
    };

    verifyUser();
  }, [token, navigate]);

  // -------------------------
  // Load permissions only after authChecked && isAdmin === true
  // -------------------------
  useEffect(() => {
    if (!authChecked || !isAdmin) return;

    let mounted = true;
    (async () => {
      try {
        const [pAdd, pEdit, pDelete,pExport] = await Promise.all([
          checkPermission("add_user"),
          checkPermission("edit_user"),
          checkPermission("delete_user"),
          checkPermission("export_user"),
        ]);
        if (!mounted) return;
        setCanAdd(pAdd);
        setCanEdit(pEdit);
        setCanDelete(pDelete);
        setCanExport(pExport);
      } catch {
        // ignore, defaults are false
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authChecked, isAdmin, checkPermission]);

  // -------------------------
  // Date formatter
  // -------------------------
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const m = [
      "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
    ];
    return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`;
  };

  // -------------------------
  // Load roles & users (admin endpoints)
  // -------------------------
  const loadRoles = useCallback(async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/auth/roles/");
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast("Failed loading roles", "error");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/api/auth/admin/users/",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const raw = Array.isArray(res.data) ? res.data : res.data.results || [];

      const formatted = await Promise.all(
        raw.map(async (u) => {
          const roleObj = roles.find((r) => Number(r.id) === Number(u.role));
          let address = {};
          try {
            const addrRes = await axios.get(
              `http://127.0.0.1:8000/api/addresses/?user=${u.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (Array.isArray(addrRes.data) && addrRes.data.length > 0) {
              address = addrRes.data[0];
            }
          } catch {}
          return {
            id: u.id,
            username: u.username,
            email: u.email,
            role: roleObj ? roleObj.role_name : "—",
            status: u.is_active ? "Active" : "Inactive",
            dateJoined: formatDate(u.date_joined),
            address,
          };
        })
      );

      setUsers(formatted);
    } catch (err) {
      // If backend says Forbidden -> likely not permitted -> notify + redirect
      if (err.response?.status === 403) {
        showToast("You are not authorized to view users.", "error");
        navigate("/dashboard", { replace: true });
      } else {
        showToast("Failed loading users", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [roles, token, navigate]);

  // Start role load once admin verified
  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    loadRoles();
  }, [authChecked, isAdmin, loadRoles]);

  // Once roles exist, load users
  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    if (roles.length) {
      loadUsers();
    }
  }, [authChecked, isAdmin, roles, loadUsers]);

  // -------------------------
  // CSV export
  // -------------------------
  const exportUsers = () => {
    const headers = [
      "Username","Email","Role","Status","Joined",
      "House/Flat","Street","Area","District","City",
      "State","Postal Code","Country",
    ];

    const csvRows = [headers.join(",")];
    users.forEach((u) => {
      const a = u.address || {};
      csvRows.push([
        u.username,u.email,u.role,u.status,u.dateJoined,
        a.house_flat || "",a.street || "",a.area || "",
        a.district || "",a.city || "",a.state || "",
        a.postal_code || "",a.country || ""
      ].join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Users_With_Address.csv";
    link.click();
  };

  // -------------------------
  // Filtering & pagination
  // -------------------------
  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);

    const matchStatus = statusFilter === "All Status" || u.status === statusFilter;
    const matchRole = roleFilter === "All Roles" || u.role === roleFilter;

    return matchSearch && matchStatus && matchRole;
  });

  const indexOfLast = currentPage * usersPerPage;
  const current = filtered.slice(indexOfLast - usersPerPage, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(filtered.length / usersPerPage));

  // -------------------------
  // Actions
  // -------------------------
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
    } catch (err) {
      const msg = err.response?.data?.message || "Delete failed";
      showToast(msg, "error");
    } finally {
      setShowConfirm(false);
      setUserToDelete(null);
    }
  };

  // -------------------------
  // Render UI
  // -------------------------
  // If auth not yet checked, show a small waiting UI (prevents flash)
  if (!authChecked) {
    return (
      <div style={{ padding: 40 }}>
        Checking permissions...
      </div>
    );
  }

  // If checked and not admin we already navigate away in effect; show fallback
  if (!isAdmin) {
    return (
      <div style={{ padding: 40 }}>
        Redirecting...
      </div>
    );
  }

  return (
    <div className="manage-users-container">
      <div className="page-header">
        <h2>User Management</h2>
        <p>View, edit and manage users</p>

        <div className="header-actions">
          <button className="export-btn" onClick={exportUsers}>
            Export
          </button>

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

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>

        <select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option>All Roles</option>
          {roles.map((r) => (
            <option key={r.id}>{r.role_name}</option>
          ))}
        </select>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr><td colSpan="6" style={{ textAlign: "center" }}>Updating data...</td></tr>
          ) : current.length > 0 ? (
            current.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td><span className={`role-badge ${String(u.role || "").toLowerCase()}`}>{u.role}</span></td>
                <td><span className={`status-badge ${String(u.status || "").toLowerCase()}`}>{u.status}</span></td>
                <td>{u.dateJoined}</td>
                <td>
                  {canEdit && (
                    <button className="action-btn edit" onClick={() => handleEdit(u)}>
                      <Edit2 size={16} />
                    </button>
                  )}

                  {canDelete && (
                    <button className="action-btn delete" onClick={() => { setUserToDelete(u); setShowConfirm(true); }}>
                      <Trash2 size={16} />
                    </button>
                  )}

                  {!canEdit && !canDelete && (
                    <span style={{ color: "#bbb" }}>No Access</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="6" style={{ textAlign:"center" }}>No users found</td></tr>
          )}
        </tbody>
      </table>

      {!loading && filtered.length > usersPerPage && (
        <div className="pagination-controls">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Prev</button>
          <span>Page {currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
        </div>
      )}

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>Delete user <b>{userToDelete?.username}</b>?</p>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            <button className="btn btn-gray" onClick={() => { setShowConfirm(false); setUserToDelete(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;
