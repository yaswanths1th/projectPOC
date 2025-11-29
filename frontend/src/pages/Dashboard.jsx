import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import api from "../utils/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [addressExists, setAddressExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // 🔐 FIXED: Using secure api instance with cookies
      // ✅ Fetch Profile
      const resProfile = await api.get("/auth/profile/");
      setProfile(resProfile.data);

      // ✅ Check Address
      const resAddr = await api.get("/addresses/check/");
      setAddressExists(resAddr.data.has_address);
    } catch (error) {
      console.error("User dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="loading-text">Loading your dashboard...</p>;

  return (
    <div className="user-dashboard-container">

      {/* ✅ FULL-WIDTH OVERVIEW CARD */}
      <div className="overview-card">

        {/* HEADER */}
        <section className="welcome-section">
          <h1 className="welcome-text">
            Welcome, {profile?.first_name || profile?.username} 👋
          </h1>
          <p className="subtitle">Here is your account overview</p>
        </section>

        {/* ✅ STATUS CARDS */}
        <section className="stats-section">
          <h3 className="section-title">Your Status</h3>

          <div className="stats-cards">

            {/* 🔵 Profile Card → Redirect to Profile Page */}
            <div
              className="stat-card"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{profile?.email ? "✓" : "—"}</h2>
                <p>Profile Completed</p>
              </div>
            </div>

            {/* 🔵 Address Card → Redirect to Address Page */}
            <div
              className="stat-card"
              onClick={() => navigate("/addresses")}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{addressExists ? "✓" : "—"}</h2>
                <p>{addressExists ? "Address Added" : "Add Address"}</p>
                
              </div>
            </div>

            {/* 🔵 Status Card → Redirect to Profile Page */}
            <div
              className="stat-card"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-info">
                <h2>{profile?.is_active ? "Active" : "Inactive"}</h2>
                <p>Account Status</p>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
