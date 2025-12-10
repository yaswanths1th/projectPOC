// frontend/src/pages/ViewProfile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ViewProfilePage.css";
import axios from "axios";
import { API_URL } from "../config/api";

function ViewProfile() {
  const [user, setUser] = useState({});
  const [address, setAddress] = useState({});
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [canEditProfile, setCanEditProfile] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const token = localStorage.getItem("access");
  const navigate = useNavigate();
  const { userId } = useParams();

  const isViewingOtherUser = !!userId;

  // compute admin flag from stored user; NOT in deps
  const isAdminLoggedIn = (() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      return !!storedUser?.is_admin;
    } catch {
      return false;
    }
  })();

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg("");

    const fetchData = async () => {
      try {
        // 1) read storedUser once here
        let storedUser;
        try {
          storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
          storedUser = {};
        }

        // 2) fetch user (self or other)
        const userUrl = isViewingOtherUser
          ? `${API_URL}/api/auth/admin/users/${userId}/`
          : `${API_URL}/api/auth/profile/`;

        let fetchedUser = null;
        try {
          const userRes = await axios.get(userUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          fetchedUser = userRes.data;
          setUser(fetchedUser);
        } catch (err) {
          console.error("[ViewProfile] user fetch failed:", err);
          if (!cancelled) {
            setErrorMsg("Failed to load profile details.");
            setLoading(false);
          }
          return; // core request failed; stop further work
        }

        // 3) subscription / plan flags
        let editFlag = false;
        let passFlag = false;

        if (fetchedUser?.subscription) {
          editFlag = !!fetchedUser.subscription.can_edit_profile;
          passFlag = !!fetchedUser.subscription.can_change_password;
        } else if (storedUser?.subscription) {
          editFlag = !!storedUser.subscription.can_edit_profile;
          passFlag = !!storedUser.subscription.can_change_password;
        }

        setCanEditProfile(editFlag);
        setCanChangePassword(passFlag);

        // 4) address (only for self) – ignore errors
        if (!isViewingOtherUser) {
          try {
            const addrRes = await axios.get(`${API_URL}/api/addresses/`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!cancelled) {
              const arr = Array.isArray(addrRes.data) ? addrRes.data : [];
              if (arr.length > 0) setAddress(arr[0]);
            }
          } catch (err) {
            console.error("[ViewProfile] address fetch failed:", err);
            // don't set global error, just skip address
          }
        }

        // 5) departments – with auth header
        try {
          const deptRes = await axios.get(`${API_URL}/api/auth/departments/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled) {
            setDepartments(deptRes.data || []);
          }
        } catch (err) {
          console.error("[ViewProfile] departments fetch failed:", err);
        }

        // 6) roles – with auth header
        try {
          const rolesRes = await axios.get(`${API_URL}/api/auth/roles/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled) {
            setRoles(rolesRes.data || []);
          }
        } catch (err) {
          console.error("[ViewProfile] roles fetch failed:", err);
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error("[ViewProfile] unexpected error:", err);
        if (!cancelled) {
          setErrorMsg("Something went wrong while loading profile.");
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, isViewingOtherUser, userId]);

  const getDepartmentName = () => {
    const dept = departments.find((d) => d.id === user.department);
    return dept ? dept.department_name : "";
  };

  const getRoleName = () => {
    const role = roles.find((r) => r.id === user.role);
    return role ? role.role_name : "";
  };

  const handleEdit = () => {
    if (isAdminLoggedIn) navigate("/admin/profile/edit");
    else navigate("/edit-profile");
  };

  const handleChangePassword = () => {
    if (isAdminLoggedIn) navigate("/admin/change-password");
    else navigate("/change-password");
  };

  const handleBackToDashboard = () => navigate("/admin/dashboard");

  if (!token) {
    return null; // already redirected in effect
  }

  return (
    <div className="view-profile-page">
      {/* Simple loading & error banners */}
      {loading && <p className="vp-loading">Loading profile...</p>}
      {!loading && errorMsg && <p className="vp-error">{errorMsg}</p>}

      <div className="view-profile-header">
        <h2>
          {isViewingOtherUser
            ? `User Profile: ${user.username}`
            : "Your Profile"}
        </h2>

        <div className="header-actions">
          {!isViewingOtherUser && (
            <>
              {(isAdminLoggedIn || canEditProfile) && (
                <button className="edit-btn" onClick={handleEdit}>
                  Edit Details
                </button>
              )}
              {(isAdminLoggedIn || canChangePassword) && (
                <button className="pass-btn" onClick={handleChangePassword}>
                  Change Password
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="profile-card">
        <h3 className="edit-subsection-title">Account Information</h3>
        <div className="edit-form-grid">
          <div className="edit-form-group">
            <label>Department</label>
            <input readOnly value={getDepartmentName()} />
          </div>

          <div className="edit-form-group">
            <label>Role</label>
            <input readOnly value={getRoleName()} />
          </div>

          <div className="edit-form-group">
            <label>Status</label>
            <input readOnly value={user.is_active ? "Active" : "Inactive"} />
          </div>

          <div className="edit-form-group">
            <label>Date Joined</label>
            <input readOnly value={formatDate(user.date_joined)} />
          </div>
        </div>
      </div>

      <div className="profile-card">
        <h3 className="edit-subsection-title">Personal Details</h3>
        <div className="edit-form-grid">
          <div className="edit-form-group">
            <label>Username</label>
            <input readOnly value={user.username || ""} />
          </div>

          <div className="edit-form-group">
            <label>First Name</label>
            <input readOnly value={user.first_name || ""} />
          </div>

          <div className="edit-form-group">
            <label>Last Name</label>
            <input readOnly value={user.last_name || ""} />
          </div>

          <div className="edit-form-group">
            <label>Phone</label>
            <input readOnly value={user.phone || ""} />
          </div>

          <div className="edit-form-group">
            <label>Email</label>
            <input readOnly value={user.email || ""} />
          </div>
        </div>
      </div>

      {!isViewingOtherUser && (
        <div className="profile-card">
          <h3 className="edit-subsection-title">Address Details</h3>
          <div className="edit-form-grid">
            {[
              { key: "house_flat", label: "Flat/House No" },
              { key: "street", label: "Street" },
              { key: "landmark", label: "Landmark" },
              { key: "area", label: "Area" },
              { key: "district", label: "District" },
              { key: "city", label: "City" },
              { key: "state", label: "State" },
              { key: "postal_code", label: "Postal Code" },
              { key: "country", label: "Country" },
            ].map(({ key, label }) => (
              <div className="edit-form-group" key={key}>
                <label>{label}</label>
                <input readOnly value={address[key] || ""} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdminLoggedIn && (
        <div className="bottom-action">
          <button className="back-btn" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default ViewProfile;
