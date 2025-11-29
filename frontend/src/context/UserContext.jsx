import React, { createContext, useEffect, useState } from "react";
import { getProfile } from "../api/auth";

export const UserContext = createContext();

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // 🔐 Call profile API instead of checking localStorage
        // Backend will verify cookies and return user data
        const response = await getProfile();
        
        if (response.ok && response.data) {
          setUser(response.data);
        } else {
          // Session invalid or cookies expired
          setUser(null);
        }
      } catch (error) {
        console.error("User fetch failed:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}
