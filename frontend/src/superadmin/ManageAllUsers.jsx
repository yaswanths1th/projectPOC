import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";
import "./ManageAllUsers.css";

export default function ManageAllUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const filter = location.state?.filter || "all";

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.get("/api/auth/admin/users/");
        let data = Array.isArray(res.data) ? res.data : [];

        if (filter === "active") {
          data = data.filter((u) => u.is_active);
        }

        if (filter === "tenant_admins") {
          data = data.filter((u) => u.is_tenant_admin);
        }

        setUsers(data);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [filter]);

  // 🔥 SHOW Dept & Role ONLY for normal users (NOT admins)
  const showDeptAndRole =
    filter !== "tenant_admins" &&
    users.some((u) => !u.is_tenant_admin && !u.is_superadmin);

  if (loading) return <div className="users-loading">Loading users...</div>;

  return (
    <div className="all-users-page">
      <div className="all-users-header">
        <h2>
          {filter === "tenant_admins" ? "Tenant Admins" : "All Users"}
        </h2>
      </div>

      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Tenant</th>

              {showDeptAndRole && <th>Department</th>}
              {showDeptAndRole && <th>Role</th>}

              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.tenant_name || "—"}</td>

                {showDeptAndRole && (
                  <td>{u.department_name || "—"}</td>
                )}
                {showDeptAndRole && (
                  <td>{u.role_name || "—"}</td>
                )}

                <td>
                  <span
                    className={`status-badge ${
                      u.is_active ? "status-active" : "status-inactive"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
