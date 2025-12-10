import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { API_URL } from "../config/api";


export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [profile, setProfile] = useState(null);
  const [addressExists, setAddressExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // 🔹 Profile
      const resProfile = await fetch(`${API_URL}/api/auth/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resProfile.ok) {
        console.error("Profile HTTP error:", resProfile.status);
        setLoading(false);
        return;
      }

      const dataProfile = await resProfile.json();
      setProfile(dataProfile);

      // 🔹 Address
      const resAddr = await fetch(`${API_URL}/api/addresses/check/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resAddr.ok) {
        console.error("Address HTTP error:", resAddr.status);
        setAddressExists(false);
      } else {
        const dataAddr = await resAddr.json();
        setAddressExists(!!dataAddr.has_address);
      }
    } catch (error) {
      console.error("User dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="loading-text">Loading your dashboard...</p>;
  }

  const displayName = profile?.first_name || storedUser?.username || "User";

  return (
    <div className="user-dashboard-container">
      <div className="overview-card">
        {/* Header */}
        <section className="welcome-section">
          <h1 className="welcome-text">
            Welcome, {displayName} 👋
          </h1>
          <p className="subtitle">Here is your account overview</p>
        </section>

        {/* Status Cards */}
        <section className="stats-section">
          <h3 className="section-title">Your Status</h3>

          <div className="stats-cards">
            {/* Profile Card */}
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

            {/* Address Card */}
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

            {/* Account Status Card */}
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
