// frontend/src/pages/PlansPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchPlans, subscribeToPlan, getCurrentSubscription } from "../api/plansApi";
import { UserContext } from "../context/UserContext";
import "./PlansPage.css";

function money(cents) {
  if (!cents || cents === 0) return "Free";
  const rupees = Math.round(cents / 100);
  return `₹${rupees}`;
}

export default function PlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useContext(UserContext);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyFor, setBusyFor] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored) {
        setUser && setUser(stored);
      } else {
        const defaultUser = { subscription: { slug: "free", can_use_ai: false } };
        setUser && setUser(defaultUser);
        localStorage.setItem("user", JSON.stringify(defaultUser));
      }
    } catch (e) {
      const defaultUser = { subscription: { slug: "free", can_use_ai: false } };
      setUser && setUser(defaultUser);
      try { localStorage.setItem("user", JSON.stringify(defaultUser)); } catch (_){}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = location.state || {};
    if (state.paymentSuccess) {
      const { text, planName } = state.paymentSuccess;
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "null");
        if (stored) {
          setUser && setUser(stored);
        }
      } catch (e) {}
      setNotification({ type: "success", text: text || "Subscription successful.", planName: planName || null });
      try { navigate(location.pathname, { replace: true, state: {} }); } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPlans()
      .then((data) => {
        if (!alive) return;
        const fetched = data || [];
        const hasFree = fetched.some(p => p.slug === "free");
        const finalPlans = hasFree ? fetched : [{ slug: "free", name: "Free", description: "Free plan", price_cents: 0, can_use_ai: false }, ...fetched];
        setPlans(finalPlans);

        try {
          const stored = JSON.parse(localStorage.getItem("user") || "null");
          if (stored) {
            if (!stored.subscription || !stored.subscription.slug) {
              const updated = { ...stored, subscription: { slug: "free", can_use_ai: false } };
              setUser && setUser(updated);
              localStorage.setItem("user", JSON.stringify(updated));
            }
          } else {
            const defaultUser = { subscription: { slug: "free", can_use_ai: false } };
            setUser && setUser(defaultUser);
            localStorage.setItem("user", JSON.stringify(defaultUser));
          }
        } catch (e) {
          const defaultUser = { subscription: { slug: "free", can_use_ai: false } };
          setUser && setUser(defaultUser);
          try { localStorage.setItem("user", JSON.stringify(defaultUser)); } catch (_){}
        }
      })
      .catch((err) => {
        console.error("fetchPlans error", err);
        if (alive) setPlans([]);
        setNotification({ type: "error", text: "Failed to load plans." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [setUser]);

  function loadLocalTables() {
    let ue = [];
    let ui = [];
    let uv = [];
    try { ue = JSON.parse(localStorage.getItem("user_error") || "[]"); } catch (e) { ue = []; }
    try { ui = JSON.parse(localStorage.getItem("user_information") || "[]"); } catch (e) { ui = []; }
    try { uv = JSON.parse(localStorage.getItem("user_validation") || "[]"); } catch (e) { uv = []; }
    return { ue, ui, uv };
  }

  async function handleSubscribe(plan_slug) {
    setBusyFor(plan_slug);
    setNotification(null);

    const { ue, ui, uv } = loadLocalTables();

    let validation = null;
    if (Array.isArray(uv) && uv.length > 0) {
      validation = uv.find(x => (x.validation_code || "").toUpperCase().startsWith("VT")) || uv[0];
    }
    if (!validation) validation = { validation_code: "IS001", validation_message: "Validation passed." };

    setNotification({ type: "validation", text: validation.validation_message || "Validation passed." });

    try {
      const res = await subscribeToPlan(plan_slug);

      // prefer server values (axios Response object returned)
      const serverUser = res?.data?.user || null;
      const serverSubscription = res?.data?.subscription || null;

      // 1) If backend returned a canonical user, persist it and update context
      if (serverUser) {
        try {
          setUser && setUser(serverUser);
          localStorage.setItem("user", JSON.stringify(serverUser));
          console.log("[PlansPage] persisted server user after subscribe:", serverUser);
        } catch (e) {
          console.warn("[PlansPage] failed persisting server user:", e);
        }
      }
      // 2) If backend returned only a subscription object, merge into existing stored user
      else if (serverSubscription) {
        try {
          const existing = JSON.parse(localStorage.getItem("user") || "{}");
          const merged = { ...(existing || {}), subscription: serverSubscription };
          setUser && setUser(merged);
          localStorage.setItem("user", JSON.stringify(merged));
          console.log("[PlansPage] merged server subscription into local user:", serverSubscription);
        } catch (e) {
          console.warn("[PlansPage] failed merging server subscription:", e);
        }
      }
      // 3) Fallback optimistic update (existing behavior)
      else {
        const chosenPlan = plans.find(p => p.slug === plan_slug);
        const canUseAI = !!(chosenPlan ? chosenPlan.can_use_ai : (plan_slug === "enterprise"));
        const updatedUser = { ...(user || {}), subscription: { slug: plan_slug, can_use_ai: canUseAI } };
        setUser && setUser(updatedUser);
        try { localStorage.setItem("user", JSON.stringify(updatedUser)); } catch (e) { console.warn(e); }
        console.log("[PlansPage] optimistic local update:", updatedUser);
      }

      // 4) FORCE authoritative refresh from server so logout/login will reflect correct subscription.
      try {
        if (typeof window !== "undefined" && typeof window.__refreshUser === "function") {
          const fresh = await window.__refreshUser();
          if (fresh) {
            try {
              setUser && setUser(fresh);
              localStorage.setItem("user", JSON.stringify(fresh));
              console.log("[PlansPage] refreshed canonical user from server after subscribe:", fresh);
            } catch (e) {
              console.warn("[PlansPage] failed to persist refreshed user:", e);
            }
          }
        } else {
          // fallback: call the /api/subscription/ endpoint and merge
          try {
            const maybeSub = await getCurrentSubscription();
            if (maybeSub) {
              const existing = JSON.parse(localStorage.getItem("user") || "{}");
              const merged = { ...(existing || {}), subscription: maybeSub };
              setUser && setUser(merged);
              localStorage.setItem("user", JSON.stringify(merged));
              console.log("[PlansPage] fetched /api/subscription/ fallback:", maybeSub);
            }
          } catch (e) {
            console.warn("[PlansPage] fallback subscription fetch failed:", e);
          }
        }
      } catch (e) {
        console.warn("[PlansPage] refreshUser call failed:", e);
      }

      const chosenPlan = plans.find(p => p.slug === plan_slug);
      const planName = chosenPlan?.name || plan_slug;
      const successText = "Subscription successful.";
      setNotification({ type: "success", text: successText, planName });
    } catch (err) {
      console.error("subscribe err", err);
      let errText = "Subscription failed.";
      if (err?.response?.data) {
        if (typeof err.response.data === "string") errText = err.response.data;
        else if (err.response.data.detail) errText = err.response.data.detail;
        else errText = JSON.stringify(err.response.data);
      } else if (err?.message) {
        errText = err.message;
      }

      let errObj = null;
      if (Array.isArray(ue) && ue.length > 0) {
        errObj = ue.find(x => (x.error_code || "").toUpperCase().startsWith("EG")) || ue[0];
      }

      setNotification({ type: "error", code: errObj?.error_code || null, text: errObj?.error_message || errText });
    } finally {
      setBusyFor(null);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading plans...</div>;

  const currentSlug = user?.subscription?.slug || "free";

  return (
    <div className="plans-container">
      <h2 className="plans-title">Plans</h2>

      {notification?.type === "validation" && (
        <div className="notification validation-box">
          <div className="validation-text">{notification.text}</div>
        </div>
      )}

      {notification?.type === "error" && (
        <div className="notification error-text">
          {notification.code && <strong style={{ marginRight: 8 }}>{notification.code}</strong>}
          {notification.text}
        </div>
      )}

      <div className="plans-grid" style={{ marginTop: 12 }}>
        {plans.map((p) => {
          const isCurrent = p.slug === currentSlug;
          return (
            <div key={p.slug} className={`plan-card ${isCurrent ? "active" : ""}`}>
              <h3 className="plan-name">{p.name}</h3>
              <div className="plan-description">{p.description}</div>
              <div className="plan-price">{money(p.price_cents)}</div>

              <ul className="plan-features">
                <li>{p.can_use_ai ? "Access to AI Chat bot" : "No AI Chat bot"}</li>
                {typeof p.can_edit_profile !== "undefined" && (
                  <li>{p.can_edit_profile ? "Edit profile" : "Cannot edit profile"}</li>
                )}
                {typeof p.can_change_password !== "undefined" && (
                  <li>{p.can_change_password ? "Change password" : "No password change"}</li>
                )}
              </ul>

              <div>
                {isCurrent ? (
                  <button className="plan-btn disabled" disabled>
                    Current Plan
                  </button>
                ) : (
                  <button
                    className="plan-btn"
                    onClick={() => {
                      if (p.slug === "free") {
                        handleSubscribe(p.slug);
                      } else {
                        navigate("/billing", { state: { planSlug: p.slug, planName: p.name, priceCents: p.price_cents } });
                      }
                    }}
                    disabled={!!busyFor}
                  >
                    {busyFor === p.slug ? "Processing..." : `Choose ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {notification?.type === "success" && (
        <div className="notification success-text below-grid">
          <span>
            {notification.text}
            {notification.planName ? ` — ${notification.planName}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
