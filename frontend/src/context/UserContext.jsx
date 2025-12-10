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

// -------- storage helpers --------
function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("[UserContext] failed to parse user from storage:", e);
    return null;
  }
}

function saveUserToStorage(user) {
  try {
    localStorage.setItem("user", JSON.stringify(user));
  } catch (e) {
    console.warn("[UserContext] failed to persist user:", e);
  }
}

// -------- provider --------
export default function UserProvider({ children }) {
  const [user, setUserState] = useState(() => loadUserFromStorage());
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    if (VERBOSE) console.log("[UserContext] clearing auth & user");
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
    } catch (e) {
      console.warn("[UserContext] error clearing storage:", e);
    }
    setUserState(null);
  }, []);

  const setUser = useCallback((u) => {
    setUserState(u);
    if (u) {
      saveUserToStorage(u);
    } else {
      try {
        localStorage.removeItem("user");
      } catch (e) {
        console.warn("[UserContext] error removing user from storage:", e);
      }
    }
  }, []);

  const fetchCanonicalUser = useCallback(
    async ({ force = false } = {}) => {
      if (VERBOSE)
        console.log("[UserContext] fetchCanonicalUser, force =", force);

      setLoading(true);

      const token = localStorage.getItem("access");
      if (!token) {
        if (VERBOSE) console.log("[UserContext] no token → guest");
        clearAuth();
        setLoading(false);
        return null;
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const res = await axios.get(PROFILE_URL, {
          headers,
          timeout: 8000,
        });

        const profile = res?.data ?? {};
        if (VERBOSE) {
          console.log("[UserContext] profile fetched:", res.status, profile);
        }

        // ✅ TRUST BACKEND SHAPE EXACTLY
        // Whatever the backend sends (including subscription/features),
        // we keep as-is and persist.
        setUser(profile);

        setLoading(false);
        return profile;
      } catch (err) {
        const status = err?.response?.status;
        const data = err?.response?.data ?? err.message;

        console.warn("[UserContext] profile fetch failed:", status, data);

        if (status === 401) {
          clearAuth();
          setLoading(false);
          return null;
        }

        // Fallback to last stored user if any
        const stored = loadUserFromStorage();
        if (stored) {
          if (VERBOSE) {
            console.log(
              "[UserContext] using stored user as fallback after error",
              stored
            );
          }
          setUserState(stored);
        } else {
          setUserState(null);
        }

        setLoading(false);
        return stored;
      }
    },
    [clearAuth, setUser]
  );

  useEffect(() => {
    fetchCanonicalUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose for debug / manual refresh
  useEffect(() => {
    try {
      window.__refreshUser = async () => {
        if (VERBOSE) console.log("[UserContext] manual refresh called");
        return await fetchCanonicalUser({ force: true });
      };
    } catch (e) {
      console.warn("[UserContext] failed to attach __refreshUser:", e);
    }

    return () => {
      try {
        delete window.__refreshUser;
      } catch (e) {
        // ignore
      }
    };
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
