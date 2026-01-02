import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config/api";
import "./SuperAdminReports.css";

export default function SuperAdminReports() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await axios.get(
          `${API_URL}/api/superadmin/tenants/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTenants(res.data || []);
      } catch (e) {
        console.error("Failed to load tenants", e);
      } finally {
        setLoading(false);
      }
    }
    loadTenants();
  }, [token]);

  if (loading) return <div>Loading tenants…</div>;

  return (
    <div className="sa-reports">
      <h2>Tenant Reports</h2>

      <div className="tenant-grid">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="tenant-card"
            onClick={() => navigate(`/superadmin/reports/${t.id}`)}
          >
            <h3>{t.name}</h3>
            <p>Slug: {t.slug}</p>
            <span className={t.is_active ? "active" : "inactive"}>
              {t.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
