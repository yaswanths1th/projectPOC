// frontend/src/api/plansApi.js
import axios from "axios";
import { API_URL } from "../config/api";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK_PLANS === "true");

function authHeaders() {
  try {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

async function tryGet(url, config = {}) {
  try {
    const res = await axios.get(url, config);
    return { ok: true, res };
  } catch (err) {
    return { ok: false, err };
  }
}

async function tryPost(url, data, config = {}) {
  try {
    const res = await axios.post(url, data, config);
    return { ok: true, res };
  } catch (err) {
    return { ok: false, err };
  }
}

export async function fetchPlans() {
  if (USE_MOCK) {
    return [
      { id: 1, slug: "free", name: "Free", price_cents: 0, can_use_ai: false, can_edit_profile: true, can_change_password: true, description: "Free forever" },
      { id: 2, slug: "basic", name: "Basic", price_cents: 49900, can_use_ai: false, can_edit_profile: true, can_change_password: true, description: "Basic tier" },
      { id: 3, slug: "pro", name: "Pro", price_cents: 129900, can_use_ai: false, can_edit_profile: true, can_change_password: true, description: "Power users" },
      { id: 4, slug: "enterprise", name: "Enterprise", price_cents: 999900, can_use_ai: true, can_edit_profile: true, can_change_password: true, description: "All features + AI" },
    ];
  }

  const base = API_URL || "";
  const candidates = [
    `${base}/api/plans/`,
    `${base}/api/subscription/plans/`,
    `${base}/plans/`
  ];

  for (const url of candidates) {
    const r = await tryGet(url, { headers: authHeaders() });
    if (r.ok && r.res.status >= 200 && r.res.status < 300) return r.res.data;
  }

  throw new Error("Failed to fetch plans from backend");
}


export async function subscribeToPlan(planSlug, opts = {}) {
  if (!planSlug) throw new Error("planSlug is required");

  if (USE_MOCK) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const updated = { ...(user || {}), subscription: { slug: planSlug, can_use_ai: planSlug === "enterprise" } };
    localStorage.setItem("user", JSON.stringify(updated));
    return { data: { user: updated, subscription: updated.subscription }, status: 200 };
  }

  const base = API_URL || "";
  const endpoints = [
    `${base}/api/subscribe/`,
    `${base}/api/subscription/subscribe/`,
    `${base}/accounts/subscribe/`,
    `${base}/subscribe/`,
    `${base}/api/subscriptions/subscribe/`
  ];

  const payload = { plan_slug: planSlug };
  if (opts.payment_provider) payload.payment_provider = opts.payment_provider;
  if (opts.payment_reference) payload.payment_reference = opts.payment_reference;

  const headers = { ...authHeaders(), "Content-Type": "application/json" };

  let lastErr = null;
  for (const url of endpoints) {
    const r = await tryPost(url, payload, { headers });
    if (r.ok && r.res.status >= 200 && r.res.status < 300) {
      const res = r.res;

      // Prefer explicit subscription field returned by backend
      let serverSubscription = null;
      let serverUser = null;
      try {
        if (res.data) {
          serverSubscription = res.data.subscription || null;
          serverUser = res.data.user || null;
        }
      } catch (e) {
        // ignore parse errors
      }

      // Persist canonical user if backend returns one, otherwise merge subscription
      try {
        if (serverUser) {
          localStorage.setItem("user", JSON.stringify(serverUser));
        } else if (serverSubscription) {
          const existing = JSON.parse(localStorage.getItem("user") || "{}");
          const merged = { ...(existing || {}), subscription: serverSubscription };
          localStorage.setItem("user", JSON.stringify(merged));
        }
      } catch (e) {
        // ignore storage errors
      }

      return res;
    }
    lastErr = r.err || r.res;
  }

  if (lastErr && lastErr.response && lastErr.response.data) {
    const err = lastErr.response.data;
    if (typeof err === "string") throw new Error(err);
    if (err.detail) throw new Error(err.detail);
    throw new Error(JSON.stringify(err));
  }

  throw new Error("Subscription failed: no endpoint responded");
}


export async function getCurrentSubscription() {
  if (USE_MOCK) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      return (user && user.subscription) ? user.subscription : null;
    } catch {
      return null;
    }
  }

  const base = API_URL || "";
  const candidates = [
    `${base}/api/subscription/`,
    `${base}/api/subscription/subscription/`,
    `${base}/subscription/`
  ];

  for (const url of candidates) {
    const r = await tryGet(url, { headers: authHeaders() });
    if (r.ok && r.res.status >= 200 && r.res.status < 300) return r.res.data;
    if (r.ok && r.res.status === 204) return null;
  }

  return null;
}
