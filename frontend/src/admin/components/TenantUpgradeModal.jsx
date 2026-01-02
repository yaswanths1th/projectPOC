// frontend/src/admin/components/TenantUpgradeModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config/api";
import "./TenantUpgradeModal.css";

export default function TenantUpgradeModal({
  open,
  onClose,
  onUpgraded,
  currentPlan
}) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("access");

  useEffect(() => {
    if (!open) return;

    axios
      .get(`${API_URL}/api/plans/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        // show only higher plans
        const filtered = res.data.filter(p => p.slug !== currentPlan);
        setPlans(filtered);
      })
      .catch(() => setPlans([]));
  }, [open, currentPlan]);

  const upgrade = async (slug) => {
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/subscription/upgrade/`,
        { plan_slug: slug },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpgraded();
    } catch {
      alert("Upgrade failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="upgrade-overlay">
      <div className="upgrade-modal">
        <h3>User limit reached</h3>
        <p>
          Your current plan <b>{currentPlan}</b> has reached its user limit.
        </p>

        <h4>Upgrade tenant plan</h4>

        {plans.map(p => (
          <div key={p.slug} className="plan-row">
            <span>{p.name}</span>
            <button disabled={loading} onClick={() => upgrade(p.slug)}>
              Upgrade
            </button>
          </div>
        ))}

        <button className="close-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
