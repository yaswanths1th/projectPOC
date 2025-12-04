// frontend/src/context/UserContext.jsx
import React, { createContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../config/api";

export const UserContext = createContext();

// Set true while debugging; false in production
const VERBOSE = true;

function normalizeSubscription(sub) {
  if (!sub) return null;
  // If backend returns an object with slug etc -> keep
  if (typeof sub === "object") {
    // Some backends return nested shapes: { id, plan: { slug, ... }, slug, name, ... }
    if (!sub.slug && sub.plan && sub.plan.slug) {
      return {
        id: sub.id ?? null,
        slug: sub.plan.slug,
        name: sub.plan.name ?? sub.plan.slug,
        is_active: typeof sub.is_active !== "undefined" ? !!sub.is_active : true,
        started_at: sub.started_at ?? sub.start_date ?? null,
        expires_at: sub.expires_at ?? sub.end_date ?? null,
        can_use_ai: !!(sub.can_use_ai ?? sub.plan?.can_use_ai ?? false),
        price_cents: sub.price_cents ?? sub.plan?.price_cents ?? null,
      };
    }
    // If already has slug, map minimal canonical fields
    if (sub.slug) {
      return {
        id: sub.id ?? null,
        slug: sub.slug,
        name: sub.name ?? sub.slug,
        is_active: typeof sub.is_active !== "undefined" ? !!sub.is_active : true,
        started_at: sub.started_at ?? sub.start_date ?? null,
        expires_at: sub.expires_at ?? sub.end_date ?? null,
        can_use_ai: !!sub.can_use_ai,
        price_cents: sub.price_cents ?? null,
      };
    }
  }

  // If backend returned a plain string like "free"
  if (typeof sub === "string") {
    return { slug: sub, name: sub, can_use_ai: false, is_active: true };
  }

  return null;
}

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const PROFILE_URL = `${API_URL}/api/auth/profile/`;
  const SUBSCRIPTION_URL = `${API_URL}/api/subscription/`;

  const fetchCanonicalUser = useCallback(async ({ force = false } = {}) => {
    setLoading(true);

    // short-circuit: if no token and not forcing a refresh, use stored user (do not overwrite)
    const token = localStorage.getItem("access");
    if (!token) {
      if (VERBOSE) console.log("[UserContext] no token found; clearing runtime user");
      setUser(null);
      setLoading(false);
      return null;
    }

    const headers = { Authorization: `Bearer ${token}` };

    let fetchedProfile = null;
    let fetchedSubscription = null;
    let gotAuthoritativeData = false;

    // 1) profile
    try {
      const pRes = await axios.get(PROFILE_URL, { headers, timeout: 7000 });
      fetchedProfile = pRes?.data ?? null;
      gotAuthoritativeData = true;
      if (VERBOSE) console.log("[UserContext] profile fetched:", pRes.status, fetchedProfile);
    } catch (err) {
      if (VERBOSE) {
        const st = err?.response?.status ?? "no-response";
        const data = err?.response?.data ?? err.message;
        console.warn("[UserContext] profile fetch failed:", st, data);
      }
      fetchedProfile = null;
    }

    // 2) subscription
    try {
      const sRes = await axios.get(SUBSCRIPTION_URL, { headers, timeout: 7000 });
      // If server returns 204 No Content, treat as null (fallback to free)
      if (sRes.status === 204) {
        fetchedSubscription = null;
      } else {
        fetchedSubscription = sRes?.data ?? null;
      }
      gotAuthoritativeData = gotAuthoritativeData || !!fetchedSubscription;
      if (VERBOSE) console.log("[UserContext] subscription fetched:", sRes.status, sRes.data);
    } catch (err) {
      if (VERBOSE) {
        const st = err?.response?.status ?? "no-response";
        const data = err?.response?.data ?? err.message;
        console.warn("[UserContext] subscription fetch failed:", st, data);
      }
      fetchedSubscription = null;
    }

    // 3) build finalUser
    let finalUser = null;

    if (fetchedProfile) {
      finalUser = { ...fetchedProfile };
    } else {
      // don't overwrite stored user unless we fetched something authoritative
      try {
        finalUser = JSON.parse(localStorage.getItem("user") || "null");
        if (VERBOSE) console.log("[UserContext] using stored user as fallback:", finalUser);
      } catch (e) {
        finalUser = null;
      }
    }

    if (!finalUser) finalUser = {};

    // attach normalized subscription only if we fetched one; otherwise keep existing subscription if present
    const normSub = normalizeSubscription(fetchedSubscription);
    if (normSub) {
      finalUser.subscription = normSub;
    } else if (!finalUser.subscription && gotAuthoritativeData) {
      // if we fetched profile but no subscription, set default free
      finalUser.subscription = { slug: "free", name: "Free", can_use_ai: false, is_active: true };
    } else {
      // if we didn't fetch anything authoritative, DO NOT overwrite finalUser.subscription
      if (VERBOSE && !gotAuthoritativeData) {
        console.log("[UserContext] no authoritative data fetched; not overwriting stored subscription.");
      }
    }

    // Persist canonical user only if we fetched at least profile or subscription (authoritative)
    if (gotAuthoritativeData) {
      try {
        localStorage.setItem("user", JSON.stringify(finalUser));
        if (VERBOSE) console.log("[UserContext] persisted canonical user to localStorage:", finalUser);
      } catch (e) {
        console.warn("[UserContext] failed to persist user:", e);
      }
    } else {
      if (VERBOSE) console.log("[UserContext] skipping persistence because no authoritative server data");
    }

    setUser(finalUser);
    setLoading(false);
    return finalUser;
  }, [PROFILE_URL, SUBSCRIPTION_URL]);

  // initial load
  useEffect(() => {
    fetchCanonicalUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // expose refresh function for manual testing
  useEffect(() => {
    try {
      window.__refreshUser = async () => {
        if (VERBOSE) console.log("[UserContext] manual refresh called");
        return await fetchCanonicalUser({ force: true });
      };
    } catch {}
    return () => { try { delete window.__refreshUser; } catch {} };
  }, [fetchCanonicalUser]);

  return (
    <UserContext.Provider value={{ user, setUser, loading, refreshUser: fetchCanonicalUser }}>
      {children}
    </UserContext.Provider>
  );
}
