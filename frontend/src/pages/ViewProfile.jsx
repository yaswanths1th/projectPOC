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

  const token = localStorage.getItem("access");
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const navigate = useNavigate();
  const { userId } = useParams();

  const isAdminLoggedIn = storedUser?.is_admin;
  const isViewingOtherUser = !!userId;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  useEffect(() => {
    if (!token) return navigate("/login");

    const fetchData = async () => {
      try {
        const userUrl = isViewingOtherUser
          ? `${API_URL}/api/auth/admin/users/${userId}/`
          : `${API_URL}/api/auth/profile/`;

        // Fetch profile
        const userRes = await axios.get(userUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fetchedUser = userRes.data;
        setUser(fetchedUser);

        // Determine plan-based permissions:
        // 1) Prefer subscription flags from fetched user (user.subscription)
        // 2) Else use localStorage storedUser.subscription
        // 3) Else try to fetch plans list and match on slug
        let editFlag = false;
        let passFlag = false;

        if (fetchedUser?.subscription) {
          // if API returns subscription with the flags
          editFlag = !!fetchedUser.subscription.can_edit_profile;
          passFlag = !!fetchedUser.subscription.can_change_password;
        } else if (storedUser?.subscription) {
          editFlag = !!storedUser.subscription.can_edit_profile;
          passFlag = !!storedUser.subscription.can_change_password;
        } else {
          // fallback: try fetching plans list and infer from slug if present
          const slug = (fetchedUser?.subscription?.slug) || (storedUser?.subscription?.slug) || null;
          if (slug) {
            try {
              const plansRes = await axios.get(`${API_URL}/api/plans/`);
              const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
              const matched = plans.find(p => p.slug === slug);
              if (matched) {
                editFlag = !!matched.can_edit_profile;
                passFlag = !!matched.can_change_password;
              }
            } catch (e) {
              // Ignore plan fetch failures (we'll keep defaults)
              console.warn("Failed to fetch plans to infer permissions:", e);
            }
          }
        }

        setCanEditProfile(editFlag);
        setCanChangePassword(passFlag);

        // Address fetch when viewing own profile
        if (!isViewingOtherUser) {
          const addrRes = await axios.get(
            `${API_URL}/api/addresses/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (Array.isArray(addrRes.data) && addrRes.data.length > 0) {
            setAddress(addrRes.data[0]);
          }
        }

        // load departments & roles (these appear to be public in your current code)
        const deptRes = await axios.get(`${API_URL}/api/auth/departments/`);
        const rolesRes = await axios.get(`${API_URL}/api/auth/roles/`);

        setDepartments(deptRes.data);
        setRoles(rolesRes.data);

      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };

    fetchData();
  }, [token, navigate, isViewingOtherUser, userId, storedUser]);

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

  return (
    <div className="view-profile-page">
      <div className="view-profile-header">
        <h2>
          {isViewingOtherUser ? `User Profile: ${user.username}` : "Your Profile"}
        </h2>

        <div className="header-actions">
          {/* Only show edit/change password for own profile AND if plan allows OR if admin */}
          {!isViewingOtherUser && (
            <>
              { (isAdminLoggedIn || canEditProfile) && (
                <button className="edit-btn" onClick={handleEdit}>
                  Edit Details
                </button>
              )}
              { (isAdminLoggedIn || canChangePassword) && (
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
