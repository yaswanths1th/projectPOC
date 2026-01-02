// frontend/src/context/UserContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import axios from "axios";
import { API_URL } from "../config/api";

export const UserContext = createContext();

const VERBOSE = true;
const PROFILE_URL = `${API_URL}/api/auth/profile/`;

/* ---------------- storage helpers ---------------- */

function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("[UserContext] failed to parse user from storage", e);
    return null;
  }
}

function saveUserToStorage(user) {
  try {
    localStorage.setItem("user", JSON.stringify(user));
  } catch (e) {
    console.warn("[UserContext] failed to persist user", e);
  }
}

/* ---------------- provider ---------------- */

export default function UserProvider({ children }) {
  const [user, setUserState] = useState(() => loadUserFromStorage());
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    if (VERBOSE) console.log("[UserContext] clearing auth");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    setUserState(null);
  }, []);

  const setUser = useCallback((u) => {
    setUserState(u ? { ...u } : null); // 🔥 always new reference
    if (u) saveUserToStorage(u);
    else localStorage.removeItem("user");
  }, []);

  /* ---------------- fetch canonical user ---------------- */

  const fetchCanonicalUser = useCallback(
    async ({ force = false } = {}) => {
      if (VERBOSE)
        console.log("[UserContext] fetchCanonicalUser force =", force);

      setLoading(true);

      const token = localStorage.getItem("access");
      if (!token) {
        clearAuth();
        setLoading(false);
        return null;
      }

      try {
        const res = await axios.get(PROFILE_URL, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });

        const profile = res?.data ?? {};

        if (VERBOSE) {
          console.log("[UserContext] profile fetched:", profile);
        }

        /**
         * 🔥 CRITICAL FIX
         * We KEEP EVERYTHING backend sends.
         * DO NOT normalize away subscription/features.
         */
        const canonicalUser = {
          ...profile,
          subscription: profile.subscription || null,
          features: profile.features || null,
        };

        setUser(canonicalUser);
        setLoading(false);
        return canonicalUser;
      } catch (err) {
        const status = err?.response?.status;
        console.warn("[UserContext] profile fetch failed:", status);

        if (status === 401) {
          clearAuth();
          setLoading(false);
          return null;
        }

        const fallback = loadUserFromStorage();
        setUserState(fallback);
        setLoading(false);
        return fallback;
      }
    },
    [clearAuth, setUser]
  );

  /* ---------------- initial load ---------------- */

  useEffect(() => {
    fetchCanonicalUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- debug helper ---------------- */

  useEffect(() => {
    window.__refreshUser = () => fetchCanonicalUser({ force: true });
    return () => delete window.__refreshUser;
  }, [fetchCanonicalUser]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loading,
        refreshUser: fetchCanonicalUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
