// frontend/src/pages/PlansPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  fetchPlans,
  subscribeToPlan,
  getCurrentSubscription,
  fetchProfile,
} from "../api/plansApi";
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
  const { user, setUser, refreshUser } = useContext(UserContext);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyFor, setBusyFor] = useState(null);
  const [notification, setNotification] = useState(null);

  // -----------------------------
  // Handle paymentSuccess state
  // -----------------------------
  useEffect(() => {
    const state = location.state || {};
    if (state.paymentSuccess) {
      const { text, planName } = state.paymentSuccess;
      setNotification({
        type: "success",
        text: text || "Subscription successful.",
        planName: planName || null,
      });

      (async () => {
        try {
          let fresh = null;

          if (
            typeof window !== "undefined" &&
            typeof window.__refreshUser === "function"
          ) {
            fresh = await window.__refreshUser();
          } else if (refreshUser) {
            fresh = await refreshUser({ force: true });
          } else {
            const profileRes = await fetchProfile();
            fresh = profileRes?.data ?? null;
          }

          if (fresh) {
            setUser && setUser(fresh);
            try {
              localStorage.setItem("user", JSON.stringify(fresh));
            } catch (e) {
              console.warn("[PlansPage] failed to persist refreshed user:", e);
            }
          }
        } catch (e) {
          console.warn("[PlansPage] refresh after payment failed:", e);
        }
      })();

      try {
        navigate(location.pathname, { replace: true, state: {} });
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // -----------------------------
  // Fetch plans from backend
  // -----------------------------
  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchPlans()
      .then((data) => {
        if (!alive) return;
        const fetched = Array.isArray(data) ? data : [];

        // Normalise features for each plan to always exist
        const normalized = fetched.map((p) => {
          const f = p.features || {};
          return {
            ...p,
            features: {
              can_use_ai: !!f.can_use_ai,
              can_edit_profile: !!f.can_edit_profile,
              can_change_password: !!f.can_change_password,
              max_projects:
                typeof f.max_projects === "number" ? f.max_projects : null,
            },
          };
        });

        const hasFree = normalized.some((p) => p.slug === "free");

        // If backend does NOT return a free row, create a synthetic one
        const freePlan = hasFree
          ? []
          : [
              {
                id: 0,
                slug: "free",
                name: "Free",
                description: "Free plan",
                price_cents: 0,
                is_active: true,
                features: {
                  can_use_ai: false,
                  can_edit_profile: false,
                  can_change_password: true,
                  max_projects: 1,
                },
              },
            ];

        const finalPlans = [...freePlan, ...normalized];
        setPlans(finalPlans);
      })
      .catch((err) => {
        console.error("fetchPlans error", err);
        if (alive) setPlans([]);
        setNotification({ type: "error", text: "Failed to load plans." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // -----------------------------
  // Local tables for messages
  // -----------------------------
  function loadLocalTables() {
    let ue = [];
    let ui = [];
    let uv = [];
    try {
      ue = JSON.parse(localStorage.getItem("user_error") || "[]");
    } catch (e) {
      ue = [];
    }
    try {
      ui = JSON.parse(localStorage.getItem("user_information") || "[]");
    } catch (e) {
      ui = [];
    }
    try {
      uv = JSON.parse(localStorage.getItem("user_validation") || "[]");
    } catch (e) {
      uv = [];
    }
    return { ue, ui, uv };
  }

  // -----------------------------
  // Subscribe handler
  // -----------------------------
  async function handleSubscribe(plan_slug) {
    setBusyFor(plan_slug);
    setNotification(null);

    const { ue, uv } = loadLocalTables();

    // Validation messages
    let validation = null;
    if (Array.isArray(uv) && uv.length > 0) {
      validation =
        uv.find((x) =>
          (x.validation_code || "").toUpperCase().startsWith("VT")
        ) || uv[0];
    }
    if (!validation)
      validation = {
        validation_code: "IS001",
        validation_message: "Validation passed.",
      };

    setNotification({
      type: "validation",
      text: validation.validation_message || "Validation passed.",
    });

    try {
      // 1) hit backend to update subscription
      await subscribeToPlan(plan_slug);

      // 2) refresh canonical user from server
      let freshUser = null;
      try {
        if (
          typeof window !== "undefined" &&
          typeof window.__refreshUser === "function"
        ) {
          freshUser = await window.__refreshUser();
        } else if (refreshUser) {
          freshUser = await refreshUser({ force: true });
        } else {
          const profileRes = await fetchProfile();
          freshUser = profileRes?.data ?? null;
        }
      } catch (e) {
        console.warn("[PlansPage] failed to refresh user after subscribe:", e);
      }

      if (freshUser) {
        setUser && setUser(freshUser);
        try {
          localStorage.setItem("user", JSON.stringify(freshUser));
        } catch (e) {
          console.warn("[PlansPage] failed to persist refreshed user:", e);
        }
      } else {
        // Fallback: only update subscription part
        try {
          const maybeSub = await getCurrentSubscription();
          if (maybeSub) {
            const existing =
              JSON.parse(localStorage.getItem("user") || "{}") || {};
            const merged = { ...existing, subscription: maybeSub };
            setUser && setUser(merged);
            localStorage.setItem("user", JSON.stringify(merged));
          }
        } catch (e) {
          console.warn("[PlansPage] fallback subscription fetch failed:", e);
        }
      }

      const chosenPlan = plans.find((p) => p.slug === plan_slug);
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
        errObj =
          ue.find((x) =>
            (x.error_code || "").toUpperCase().startsWith("EG")
          ) || ue[0];
      }

      setNotification({
        type: "error",
        code: errObj?.error_code || null,
        text: errObj?.error_message || errText,
      });
    } finally {
      setBusyFor(null);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading plans...</div>;

  // current plan slug from profile in UserContext
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
          {notification.code && (
            <strong style={{ marginRight: 8 }}>{notification.code}</strong>
          )}
          {notification.text}
        </div>
      )}

      <div className="plans-grid" style={{ marginTop: 12 }}>
        {plans.map((p) => {
          const isCurrent = p.slug === currentSlug;
          const f = p.features || {};
          const aiAllowed = !!f.can_use_ai;
          const canEditProfile = !!f.can_edit_profile;
          const canChangePassword = !!f.can_change_password;
          const maxProjects =
            typeof f.max_projects === "number" ? f.max_projects : null;

          return (
            <div
              key={p.slug}
              className={`plan-card ${isCurrent ? "active" : ""}`}
            >
              <h3 className="plan-name">{p.name}</h3>
              <div className="plan-description">{p.description}</div>
              <div className="plan-price">{money(p.price_cents)}</div>

              <ul className="plan-features">
                <li>
                  {aiAllowed ? "✅ AI Chat available" : "❌ No AI Chat bot"}
                </li>
                <li>
                  {canEditProfile
                    ? "✅ Can edit profile"
                    : "❌ Cannot edit profile"}
                </li>
                <li>
                  {canChangePassword
                    ? "✅ Can change password"
                    : "❌ No password change"}
                </li>
                {maxProjects !== null && (
                  <li>📁 Max projects: {maxProjects}</li>
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
                        navigate("/billing", {
                          state: {
                            planSlug: p.slug,
                            planName: p.name,
                            priceCents: p.price_cents,
                          },
                        });
                      }
                    }}
                    disabled={!!busyFor}
                  >
                    {busyFor === p.slug
                      ? "Processing..."
                      : `Choose ${p.name}`}
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
