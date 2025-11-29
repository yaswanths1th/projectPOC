import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ViewProfilePage.css";
import api from "../utils/api";

function ViewProfile() {
  const [user, setUser] = useState({});
  const [address, setAddress] = useState({});
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);

  // 🔐 FIXED: No localStorage token needed - Cookies sent automatically

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
    const fetchData = async () => {
      try {
        // 🔐 FIXED: Using secure api instance with cookies
        const userUrl = isViewingOtherUser
          ? `/auth/admin/users/${userId}/`
          : `/auth/profile/`;

        const userRes = await api.get(userUrl);
        setUser(userRes.data);

        if (!isViewingOtherUser) {
          const addrRes = await api.get("/addresses/");
          if (Array.isArray(addrRes.data) && addrRes.data.length > 0) {
            setAddress(addrRes.data[0]);
          }
        }

        const deptRes = await api.get("/auth/departments/");
        const rolesRes = await api.get("/auth/roles/");

        setDepartments(deptRes.data);
        setRoles(rolesRes.data);

      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };

    fetchData();
  }, [navigate, isViewingOtherUser, userId]);

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
          {!isViewingOtherUser && (
            <>
              <button className="edit-btn" onClick={handleEdit}>
                Edit Details
              </button>
              <button className="pass-btn" onClick={handleChangePassword}>
                Change Password
              </button>
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
