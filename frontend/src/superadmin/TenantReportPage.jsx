import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_URL } from "../config/api";
import "./SuperAdminReports.css";

export default function TenantReportPage() {
  const { tenantId } = useParams();
  const token = localStorage.getItem("access");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await axios.get(
          `${API_URL}/api/superadmin/tenants/${tenantId}/report/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setReport(res.data);
      } catch (e) {
        console.error("Failed to load report", e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [tenantId, token]);

  if (loading) return <div>Loading report…</div>;
  if (!report) return <div>Report unavailable</div>;

  return (
    <div className="tenant-report">
      <h2>{report.tenant.name} — Report</h2>

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <strong>Plan</strong>
          <p>{report.subscription.plan}</p>
        </div>

        <div className="summary-card">
          <strong>Status</strong>
          <p>{report.subscription.status}</p>
        </div>

        <div className="summary-card">
          <strong>Users</strong>
          <p>{report.users.total}</p>
        </div>

        <div className="summary-card">
          <strong>Active Users</strong>
          <p>{report.users.active}</p>
        </div>
      </div>

      {/* Usage */}
      <h3>Usage</h3>
      <table className="usage-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Used</th>
            <th>Limit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {report.usage.map((u) => (
            <tr key={u.resource}>
              <td>{u.resource}</td>
              <td>{u.used}</td>
              <td>{u.limit ?? "∞"}</td>
              <td className={`status ${u.status.toLowerCase()}`}>
                {u.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
