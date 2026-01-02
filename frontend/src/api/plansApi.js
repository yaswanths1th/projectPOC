import axios from "axios";
import { API_URL } from "../config/api";

const USE_MOCK = false;

/* ---------------- helpers ---------------- */

function authHeaders() {
  try {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/* ---------------- plans ---------------- */

/**
 * PUBLIC plans – used by LandingPage
 * ❌ no auth
 * ✅ never logs user out
 */
export async function fetchPlans() {
  if (USE_MOCK) {
    return [
      { id: 1, slug: "free", name: "Free", price_cents: 0, description: "Free forever" },
      { id: 2, slug: "basic", name: "Basic", price_cents: 49900, description: "Basic tier" },
      { id: 3, slug: "pro", name: "Pro", price_cents: 129900, description: "Power users" },
      { id: 4, slug: "enterprise", name: "Enterprise", price_cents: 999900, description: "All features + AI" },
    ];
  }

  const base = API_URL || "";
  const url = `${base}/api/public/plans/`;

  const res = await axios.get(url);
  return res.data;
}

/**
 * AUTH plans – admin/internal use only
 */
export async function fetchPrivatePlans() {
  const base = API_URL || "";
  const url = `${base}/api/plans/`;

  const res = await axios.get(url, { headers: authHeaders() });
  return res.data;
}

/* ---------------- profile ---------------- */

export async function fetchProfile() {
  if (USE_MOCK) {
    try {
      return { data: JSON.parse(localStorage.getItem("user") || "null") || null };
    } catch {
      return { data: null };
    }
  }

  const base = API_URL || "";
  const url = `${base}/api/auth/profile/`;

  const res = await axios.get(url, { headers: authHeaders() });
  return res;
}

/* ---------------- subscription ---------------- */

export async function getCurrentSubscription() {
  if (USE_MOCK) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      return user?.subscription ?? null;
    } catch {
      return null;
    }
  }

  const base = API_URL || "";
  const url = `${base}/api/subscription/current/`;

  try {
    const res = await axios.get(url, { headers: authHeaders() });
    return res.data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/* ---------------- subscribe ---------------- */

export async function subscribeToPlan(planSlug, opts = {}) {
  if (!planSlug) throw new Error("planSlug is required");

  if (USE_MOCK) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const updated = {
      ...(user || {}),
      subscription: {
        slug: planSlug,
        can_use_ai: planSlug === "enterprise",
      },
    };
    localStorage.setItem("user", JSON.stringify(updated));
    return { data: { subscription: updated.subscription }, status: 200 };
  }

  const base = API_URL || "";
  const url = `${base}/api/subscribe/`;

  const payload = { plan_slug: planSlug };
  if (opts.payment_provider) payload.payment_provider = opts.payment_provider;
  if (opts.payment_reference) payload.payment_reference = opts.payment_reference;

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const res = await axios.post(url, payload, { headers });
  return res;
}
