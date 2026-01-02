import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./TenantList.css";

function TenantList() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", slug: "" });
  const navigate = useNavigate();
  const [confirmTenant, setConfirmTenant] = useState(null);

  const location = useLocation();
  const filter = location.state?.filter || "all";

  // -----------------------------
  // Fetch tenants
  // -----------------------------
  const fetchTenants = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/auth/tenants/");
      setTenants(Array.isArray(res.data) ? res.data : []);
    } catch {
      setErr("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // -----------------------------
  // Filter
  // -----------------------------
  const filteredTenants = tenants.filter((t) => {
    if (filter === "active") return t.is_active;
    return true;
  });

  // -----------------------------
  // Modal handlers
  // -----------------------------
  const openCreate = () => {
    setForm({ id: null, name: "", slug: "" });
    setShowForm(true);
    setErr("");
  };

  const openEdit = (t) => {
    setForm({ id: t.id, name: t.name, slug: t.slug });
    setShowForm(true);
    setErr("");
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({ id: null, name: "", slug: "" });
    setErr("");
  };

  // -----------------------------
  // Save tenant
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.slug) {
      setErr("Name and slug are required");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      if (form.id) {
        await api.put(`/api/auth/tenants/${form.id}/`, form);
      } else {
        await api.post("/api/auth/tenants/", form);
      }
      await fetchTenants();
      closeForm();
    } catch {
      setErr("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------
  // Toggle active
  // -----------------------------
const toggleActive = async () => {
  if (!confirmTenant) return;

  try {
    const res = await api.patch(
      `/api/auth/tenants/${confirmTenant.id}/`,
      { is_active: !confirmTenant.is_active }
    );

    setTenants((prev) =>
      prev.map((x) =>
        x.id === confirmTenant.id
          ? { ...x, is_active: res.data.is_active }
          : x
      )
    );
  } catch (e) {
    console.error(e);
    setErr("Failed to update tenant status");
  } finally {
    setConfirmTenant(null); // close modal
  }
};


  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="sa-tenants-page">
      <div className="sa-header">
        <h2>Tenants</h2>
        <button className="btn primary" onClick={openCreate}>
          + New Tenant
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading tenants…</div>
      ) : err ? (
        <div className="error">{err}</div>
      ) : (
        <div className="tenant-grid">
          {filteredTenants.map((t) => (
           <div
              key={t.id}
              className={`tenant-card ${!t.is_active ? "disabled" : ""}`}
            >
              <div className="tenant-top">
                <div className="tenant-name">{t.name}</div>
                <div
                  className={`tenant-status ${
                    t.is_active ? "active" : "inactive"
                  }`}
                >
                  {t.is_active ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="tenant-slug">{t.slug}</div>

              <div className="tenant-actions">
                <button
                  className="btn edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(t);
                  }}
                >
                  Edit
                </button>


               <button
  className={`btn ${t.is_active ? "deactivate" : "activate"}`}
  onClick={(e) => {
    e.stopPropagation();
    setConfirmTenant(t);   // 🔥 open modal ONLY
  }}
>
  {t.is_active ? "Deactivate" : "Activate"}
</button>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Modal ---------------- */}
      {showForm && (
        <div className="sa-modal">
          <div className="sa-modal-inner">
            <h3>{form.id ? "Edit Tenant" : "Create Tenant"}</h3>

            <form onSubmit={handleSubmit}>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>

              <label>
                Slug
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value }))
                  }
                />
              </label>

              {err && <div className="error">{err}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn cancel"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : form.id ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmTenant && (
  <div className="sa-modal">
    <div className="sa-modal-inner">
      <h3>
        {confirmTenant.is_active
          ? "Deactivate Tenant"
          : "Activate Tenant"}
      </h3>

      <p>
        Are you sure you want to{" "}
        {confirmTenant.is_active ? "deactivate" : "activate"}{" "}
        <strong>{confirmTenant.name}</strong>?
      </p>

      <div className="modal-actions">
        <button
          className="btn cancel"
          onClick={() => setConfirmTenant(null)}
        >
          No
        </button>

        <button
          className={`btn ${
            confirmTenant.is_active ? "deactivate" : "activate"
          }`}
          onClick={toggleActive}
        >
          Yes
        </button>
      </div>
    </div>
  </div>
)}

    </div>
    
  );
}

export default TenantList;
