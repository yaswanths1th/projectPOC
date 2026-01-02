import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../config/api";
import "./AdminBillingPage.css";

export default function AdminBillingPage() {
  const token = localStorage.getItem("access");

  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, usageRes] = await Promise.all([
          axios.get(`${API_URL}/api/plans/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/api/admin/usage-summary/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
        setUsage(usageRes.data);
      } catch (e) {
        console.error("Billing load failed", e);
        setUsage(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

 async function upgradePlan(planSlug) {
  try {
    setUpgrading(planSlug);

    await axios.post(
      `${API_URL}/api/subscription/upgrade/`,
      { plan_slug: planSlug },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 🔥 refresh usage so UI reflects DB
    const usageRes = await axios.get(
      `${API_URL}/api/admin/usage-summary/`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setUsage(usageRes.data);
  } catch (e) {
    console.error(e);
    alert("Upgrade failed");
  } finally {
    setUpgrading(null);
  }
}


  if (loading) return <div>Loading billing…</div>;
  if (!usage) return <div>Billing data unavailable</div>;

  const currentPlanSlug = usage?.plan?.slug || null;
  const hasActivePlan = Boolean(currentPlanSlug);
  return (
    <div className="admin-billing">
      <h2>Plans & Billing</h2>

     <div className="current-plan">
  <strong>Current Plan:</strong>{" "}
  {hasActivePlan ? usage.plan.name : "No active plan"}
</div>


<div className="usage-section">
  {(usage.resources || []).map((r) => (
          <div key={r.key} className="usage-row">
            <span>{r.key}</span>
            <span>{r.used} / {r.limit}</span>
            {r.status === "LIMIT_EXCEEDED" && (
              <span className="danger">Upgrade required</span>
            )}
          </div>
        ))}
      </div>

      <div className="plans-grid">
        {plans.map((p) => {
          const isCurrent = currentPlanSlug === p.slug;
  const canSelect =
  !isCurrent && (!hasActivePlan || p.slug !== "free");


          return (
            <div key={p.slug} className={`plan-card ${isCurrent ? "active" : ""}`}>
              <h3>{p.name}</h3>
              <p>{p.price_cents ? `₹${p.price_cents / 100}` : "Free"}</p>
<button
  disabled={!canSelect || upgrading === p.slug}
  onClick={() => upgradePlan(p.slug)}
>
  {isCurrent
    ? "Current"
    : upgrading === p.slug
    ? "Processing..."
    : hasActivePlan
    ? "Upgrade"
    : "Select Plan"}
</button>

            </div>
          );
        })}
      </div>
    </div>
  );
}
