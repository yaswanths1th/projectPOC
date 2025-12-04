// frontend/src/pages/LoginPage.jsx
import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "./LoginPage.css";
import { API_URL } from "../config/api";
import { UserContext } from "../context/UserContext";

const VERBOSE = true; // set false to silence console logs

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  // helper to try multiple URLs for subscription/profile (robustness)
  async function tryFetchCandidates(candidates = [], init = {}) {
    for (const url of candidates) {
      try {
        const r = await fetch(url, init);
        const text = await r.text().catch(() => "");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        if (VERBOSE) console.log("tryFetchCandidates:", url, r.status, json ?? text);
        // return both status and parsed json (or raw text)
        return { ok: r.ok, status: r.status, data: json, raw: text, url };
      } catch (err) {
        if (VERBOSE) console.warn("tryFetchCandidates failed for", url, err);
        // continue to next candidate
      }
    }
    return { ok: false, status: null, data: null, raw: null, url: null };
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const loginRes = await fetch(`${API_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const loginJson = await (async () => {
        try { return await loginRes.json(); } catch { return {}; }
      })();

      if (!loginRes.ok || !loginJson.access) {
        setMessage(loginJson.message || "Login failed");
        // clear potential stale state
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("user");
        return;
      }

      // Save tokens immediately
      localStorage.setItem("access", loginJson.access);
      if (loginJson.refresh) localStorage.setItem("refresh", loginJson.refresh);

      // Build headers for subsequent calls
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${loginJson.access}` };

      // Try to fetch canonical profile from common candidate endpoints
      const profileCandidates = [
        `${API_URL}/api/auth/profile/`,
        `${API_URL}/api/profile/`,
        `${API_URL}/profile/`,
        `${API_URL}/accounts/profile/`,
      ];
      const profileResult = await tryFetchCandidates(profileCandidates, { method: "GET", headers });

      let profile = profileResult.data || null;
      if (!profile) {
        // fallback to minimal profile from login response
        profile = {
          username: loginJson.username || username,
          email: loginJson.email || "",
          role_id: loginJson.role_id || null,
          role_name: loginJson.role_name || null,
          is_admin: loginJson.is_admin || false,
          permissions: loginJson.permissions || [],
        };
      }

      // Try to fetch subscription from candidate endpoints (some backends return 204)
      const subscriptionCandidates = [
        `${API_URL}/api/subscription/`,
        `${API_URL}/subscription/`,
        `${API_URL}/api/subscriptions/current/`,
        `${API_URL}/api/subscription/subscription/`,
      ];
      const subResult = await tryFetchCandidates(subscriptionCandidates, { method: "GET", headers });

      let subscription = null;
      if (subResult.status === 204) {
        subscription = { slug: "free", can_use_ai: false };
      } else if (subResult.data) {
        // backend may return either {slug:..., can_use_ai:...} or full detail
        subscription = subResult.data;
      } else {
        // Last attempt: maybe profile contained subscription
        subscription = profile.subscription || null;
      }

      // Normalise subscription object: we only need slug and can_use_ai for UI
      if (subscription) {
        if (typeof subscription === "string") {
          subscription = { slug: subscription, can_use_ai: false };
        } else if (subscription.slug) {
          // already fine
        } else {
          // try to derive slug from possible shapes
          if (subscription.plan && subscription.plan.slug) {
            subscription = { slug: subscription.plan.slug, can_use_ai: !!subscription.plan.can_use_ai };
          } else if (subscription.name && typeof subscription.name === "string") {
            subscription = { slug: subscription.name.toLowerCase(), can_use_ai: !!subscription.can_use_ai };
          } else {
            subscription = { slug: "free", can_use_ai: false };
          }
        }
      } else {
        subscription = { slug: "free", can_use_ai: false };
      }

      // Attach canonical subscription to profile
      profile.subscription = subscription;

      // Persist canonical user exactly once
      try {
        localStorage.setItem("user", JSON.stringify(profile));
      } catch (e) {
        console.warn("Failed to write user to localStorage:", e);
      }

      // Update context so UI re-renders
      if (setUser) setUser(profile);

      if (VERBOSE) {
        console.log("[Login] loginResponse:", loginJson);
        console.log("[Login] profile fetched from:", profileResult.url, profileResult.status, profileResult.data);
        console.log("[Login] subscription fetched from:", subResult.url, subResult.status, subResult.data);
        console.log("[Login] final persisted profile:", profile);
      }

      setMessage("Login successful");

      // Route user as before
      const roleId = Number(profile.role_id || loginJson.role_id || 0);
      setTimeout(async () => {
        if (!isNaN(roleId) && roleId !== 2) {
          navigate("/admin/dashboard", { replace: true });
          return;
        }
        try {
          const addrRes = await fetch(`${API_URL}/api/addresses/check/`, { method: "GET", headers });
          const addrData = await addrRes.json().catch(() => ({}));
          if (addrRes.ok && addrData.has_address) navigate("/dashboard", { replace: true });
          else navigate("/addresses", { replace: true });
        } catch {
          navigate("/addresses", { replace: true });
        }
      }, 600);
    } catch (err) {
      console.error("Login error:", err);
      setMessage("Server error");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="login-container">
        <h2>Login</h2>

        <form onSubmit={handleLogin} className="login-form" noValidate>
          <input className="login-input" type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />

          <div className="password-wrapper">
            <input className="login-input" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <span className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</span>
          </div>

          {message && <p className={`login-message ${message === "Login successful" ? "success-text" : "error-text"}`}>{message}</p>}

          <button className="login-button" type="submit">Login</button>
        </form>

        <div className="login-links">
          <p><Link to="/forgot-password">Forgot password?</Link></p>
          <p>Don’t have an account? <Link to="/register">Register</Link></p>
        </div>
      </div>
    </div>
  );
}
