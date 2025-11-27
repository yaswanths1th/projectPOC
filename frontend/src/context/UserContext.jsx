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

  // ------------------------------------------------
  // Load authenticated user profile
  // ------------------------------------------------
  const loadProfile = useCallback(async () => {
  try {
    const res = await api.get("/api/auth/profile/"); // automatically sends cookies
    setUser(res.data);
    localStorage.setItem("user", JSON.stringify(res.data));
  } catch (err) {
    // Silently ignore 401 instead of resetting user
    if (!err.silent && err.response?.status !== 401) {
      console.error("Profile load failed:", err);
    }
  } finally {
    setLoading(false);
  }
}, []);


  // ------------------------------------------------
  // Run once at app load
  // ------------------------------------------------
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <UserContext.Provider value={{ user, setUser, loading, reloadUser: loadProfile }}>
      {!loading && children}
    </UserContext.Provider>
  );
}
