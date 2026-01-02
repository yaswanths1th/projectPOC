import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";

import {
  getAdminStats,
  getUserGrowth,
  getRecentUsers,
} from "../api/reports";

import "./Reports.css";

const COLORS = ["#2ecc71", "#f39c12"];

// Date format: 12 Dec
const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

export default function Reports() {
  const navigate = useNavigate();

  const savedDays = Number(localStorage.getItem("reports_days")) || 7;

  const [stats, setStats] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [users, setUsers] = useState([]);
  const [days, setDays] = useState(savedDays);

  useEffect(() => {
    localStorage.setItem("reports_days", days);
    loadAll();
  }, [days]);

  const loadAll = async () => {
    const [statsRes, growthRes, usersRes] = await Promise.all([
      getAdminStats(),
      getUserGrowth(days),
      getRecentUsers(days),
    ]);

    setStats(statsRes.data);
    setGrowth(growthRes.data);
    setUsers(usersRes.data);
  };

  const exportCSV = () => {
    if (!users.length) return;

    const headers = ["Username", "Email", "Status", "Joined"];
    const rows = users.map((u) => [
      u.username,
      u.email,
      u.is_active ? "Active" : "On Hold",
      new Date(u.joined).toLocaleDateString(),
    ]);

    const csv =
      headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "user-report.csv";
    a.click();
  };

  if (!stats) return <div className="reports-loading">Loading reports…</div>;

  const pieData = [
    { name: "Active Users", value: stats.active_users },
    { name: "Hold Users", value: stats.hold_users },
  ];

  return (
    <div className="reports-page">
      {/* HEADER */}
      <div className="reports-header">
        <div>
          <h2>Admin Reports</h2>
          <p>
            Showing data for last {days} days (compared to previous period)
          </p>
        </div>

        <select value={days} onChange={(e) => setDays(+e.target.value)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <KPI
          title="Total Users"
          value={stats.total_users}
          onClick={() => navigate("/admin/users", { state: { statusFilter: "All Status" } })}
        />
        <KPI
          title="Active Users"
          value={stats.active_users}
          onClick={() => navigate("/admin/users", { state: { statusFilter: "Active" } })}
        />
        <KPI
          title="Hold Users"
          value={stats.hold_users}
          onClick={() => navigate("/admin/users", { state: { statusFilter: "Inactive" } })}
        />
      </div>

      {/* CHARTS */}
      <div className="charts-row">
        {/* PIE */}
        <div className="chart-card">
          <h3>User Status Distribution</h3>

          {stats.hold_users === 0 && (
            <p className="health-text">No users on hold — system healthy ✅</p>
          )}

          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* AREA */}
        <div className="chart-card">
          <h3>User Registration Trend</h3>

          {growth.length === 0 ? (
            <p className="health-text">No new users in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="growthColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003691" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#003691" stopOpacity={0.2} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={formatDate} />

                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#003691"
                  fill="url(#growthColor)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="table-card">
        <div className="table-header">
          <h3>Recent User Registrations</h3>
          <button onClick={exportCSV}>Export CSV</button>
        </div>

        {users.length === 0 ? (
          <p className="health-text">No users found for this period</p>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "green" : "yellow"}`}>
                      {u.is_active ? "Active" : "On Hold"}
                    </span>
                  </td>
                  <td>{new Date(u.joined).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KPI({ title, value, onClick }) {
  return (
    <div className="kpi-card clickable" onClick={onClick}>
      <h2>{value}</h2>
      <p>{title}</p>
    </div>
  );
}
