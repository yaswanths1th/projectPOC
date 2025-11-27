// src/context/UserContext.jsx
import React, { createContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios";

export const UserContext = createContext();

export default function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/profile/");  // 🍪 reads access_token cookie
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
    } catch (err) {
      // ignore 401 as 'not logged in'
      if (!err.silent && err.response?.status !== 401) {
        console.error("Profile load failed:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <UserContext.Provider
      value={{ user, setUser, loading, reloadUser: loadProfile }}
    >
      {!loading && children}
    </UserContext.Provider>
  );
}
