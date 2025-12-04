// frontend/src/pages/BillingPage.jsx
import React, { useState, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { subscribeToPlan } from "../api/plansApi";
import { UserContext } from "../context/UserContext";
import "./BillingPage.css";

/**
 * BillingPage
 *
 * - Attempts to call subscribeToPlan(planSlug) which should call your backend.
 * - If backend returns a canonical user (res.data.user) it will be persisted.
 * - Otherwise, if backend returns a subscription (res.data.subscription) we merge it into stored user.
 * - Falls back to a local mock write only if network subscribe fails.
 */

function money(cents) {
  if (!cents || cents === 0) return "Free";
  const rupees = Math.round(cents / 100);
  return `₹${rupees}`;
}

function readQueryParams(search) {
  try {
    const q = new URLSearchParams(search);
    const plan = q.get("plan");
    const price = q.get("price");
    const name = q.get("name");
    return {
      plan,
      price: price ? Number(price) : null,
      name
    };
  } catch (e) {
    return { plan: null, price: null, name: null };
  }
}

export default function BillingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);

  // prefer location.state; fallback to query params
  const fromState = (location && location.state) || {};
  const q = readQueryParams(location.search || "");

  const planSlug = fromState.planSlug || q.plan || "free";
  const planName = fromState.planName || q.name || (planSlug ? planSlug.charAt(0).toUpperCase() + planSlug.slice(1) : "Free");
  const priceCents = typeof fromState.priceCents !== "undefined" ? fromState.priceCents : (q.price ? Number(q.price) : 0);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    // clear messages when plan changes
    setError(null);
    setSuccess(null);
  }, [planSlug, priceCents]);

  function validate() {
    setError(null);
    const phoneClean = (phone || "").trim();
    const phoneOk = /^\+?\d{7,15}$/.test(phoneClean);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());

    if (!phoneOk && !emailOk) {
      setError("Enter a valid phone number or a valid email.");
      return false;
    }
    return true;
  }

  async function handlePay(e) {
    e && e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate short network delay for UX
      await new Promise((res) => setTimeout(res, 500));

      // Try to call canonical subscribe API via subscribeToPlan
      let apiResponse = null;
      try {
        apiResponse = await subscribeToPlan(planSlug, {
          // optionally include payment data if you have any
          payment_provider: null,
          payment_reference: null
        });
      } catch (apiErr) {
        // swallow — we'll fallback to local mock write below
        console.warn("subscribeToPlan failed (will fallback to local write):", apiErr);
        apiResponse = null;
      }

      // If API returned canonical user/subscription, persist that authoritative value
      if (apiResponse && apiResponse.data) {
        const serverUser = apiResponse.data.user || null;
        const serverSubscription = apiResponse.data.subscription || null;

        if (serverUser) {
          try {
            localStorage.setItem("user", JSON.stringify(serverUser));
          } catch (e) {
            console.warn("Failed to persist server user to localStorage:", e);
          }
          if (setUser) setUser(serverUser);
        } else if (serverSubscription) {
          try {
            const existing = JSON.parse(localStorage.getItem("user") || "{}");
            const merged = { ...(existing || {}), subscription: serverSubscription };
            localStorage.setItem("user", JSON.stringify(merged));
            if (setUser) setUser(merged);
          } catch (e) {
            console.warn("Failed to merge/persist server subscription:", e);
          }
        } else {
          // No usable data returned — fallback to optimistic local write
          const existing = JSON.parse(localStorage.getItem("user") || "{}");
          const updatedUser = { ...(existing || {}), subscription: { slug: planSlug, can_use_ai: planSlug === "enterprise" } };
          try { localStorage.setItem("user", JSON.stringify(updatedUser)); } catch (e) {}
          if (setUser) setUser(updatedUser);
        }
      } else {
        // No API response — perform local mock write (as your previous behavior)
        try {
          const existing = JSON.parse(localStorage.getItem("user") || "{}");
          const updatedUser = {
            ...(existing || {}),
            subscription: { slug: planSlug, can_use_ai: planSlug === "enterprise" }
          };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          if (setUser) setUser(updatedUser);
        } catch (e) {
          console.warn("Failed to update localStorage user (mock fallback):", e);
        }
      }

      // Build success message and navigate back to Plans page with state
      const successMessage = `Payment recorded for ${planName}`;
      const amountText = money(priceCents);

      // Set a short-lived success state (optional)
      setSuccess({ message: successMessage, amount: amountText, plan: planName });

      // Navigate to plans — PlansPage will display the message from location.state
      navigate("/account/plans", {
        state: {
          paymentSuccess: {
            text: successMessage,
            planName: planName,
            amount: amountText
          }
        },
        replace: true
      });
    } catch (err) {
      console.error("Payment/subscribe error:", err);
      setError("Payment failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="billing-page">
      <div className="billing-card">
        <h2 className="billing-title">Billing</h2>

        <div className="plan-summary">
          <div className="plan-row">
            <div className="label">Plan</div>
            <div className="value plan-name">{planName}</div>
          </div>

          <div className="plan-row">
            <div className="label">Price</div>
            <div className="value plan-price">{money(priceCents)}</div>
          </div>

          <div className="plan-row">
            <div className="label">Plan slug</div>
            <div className="value plan-slug">{planSlug}</div>
          </div>
        </div>

        <form className="billing-form" onSubmit={handlePay}>
          <label className="field">
            <div className="field-label">Phone (optional)</div>
            <input
              className="input"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </label>

          <label className="field">
            <div className="field-label">Email (optional)</div>
            <input
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
            />
          </label>

          {error && <div className="msg error">{error}</div>}
          {success && (
            <div className="msg success">
              <strong>{success.message}</strong>
              <div className="small">Plan: {success.plan} • Amount: {success.amount}</div>
            </div>
          )}

          <div className="actions">
            <button
              type="submit"
              className="pay-btn"
              disabled={busy}
            >
              {busy ? "Processing…" : `Pay ${money(priceCents)}`}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>
        </form>

        <div className="billing-note">
          This is a demo billing page — integrate with your payment gateway for production.
        </div>
      </div>
    </div>
  );
}
