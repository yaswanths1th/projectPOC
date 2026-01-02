// frontend/src/pages/LoginPage.jsx
import React, { useState, useContext,useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "./LoginPage.css";
import { API_URL } from "../config/api";
import { UserContext } from "../context/UserContext";

const VERBOSE = true; // set false to silence console logs

const FALLBACK_CODES = {
  LOGIN_FAILED: "EL001",
  LOGIN_SUCCESS: "IL001",
  SERVER_ERROR: "EA010",
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const { setUser, refreshUser } = useContext(UserContext) || {};
  const navigate = useNavigate();
  const [messageType, setMessageType] = useState(""); // "error" | "success"

  const [msgTables, setMsgTables] = useState({
    user_error: {},
    user_information: {},
  });

  
  useEffect(() => {
  (async () => {
    try {
      if (!localStorage.getItem("messages_loaded")) {
        const res = await fetch(`${API_URL}/api/auth/messages/`);
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("user_error", JSON.stringify(data.user_error || []));
          localStorage.setItem("user_information", JSON.stringify(data.user_information || []));
          localStorage.setItem("user_validation", JSON.stringify(data.user_validation || []));
          localStorage.setItem("messages_loaded", "1");
        }
      }

      // ✅ NOW safely read messages
      const errors = JSON.parse(localStorage.getItem("user_error") || "[]");
      const infos = JSON.parse(localStorage.getItem("user_information") || "[]");

      const errMap = {};
      errors.forEach(e => e?.error_code && (errMap[e.error_code.toUpperCase()] = e.error_message || ""));

      const infoMap = {};
      infos.forEach(i => i?.information_code && (infoMap[i.information_code.toUpperCase()] = i.information_text || ""));

      setMsgTables({ user_error: errMap, user_information: infoMap });
    } catch {
      setMsgTables({ user_error: {}, user_information: {} });
    }
  })();
}, []);


  const getErrorText = (code) =>
  msgTables.user_error[(code || "").toUpperCase()] || "";

  const getInfoText = (code) =>
    msgTables.user_information[(code || "").toUpperCase()] || "";


  // Generic helper to try multiple URLs (used only for profile now)
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
        const code =
  String(loginJson.code || FALLBACK_CODES.LOGIN_FAILED);

setMessage(
  loginJson.message ||
  getErrorText(code) ||
  "Invalid credentials"
);
setMessageType("error");
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
        id: loginJson.id,
        username: loginJson.username || username,
        email: loginJson.email || "",

        tenant_id: loginJson.tenant_id,
        tenant_name: loginJson.tenant_name,

        department_id: loginJson.department_id,
        department_name: loginJson.department_name,

        role_id: loginJson.role_id,
        role_name: loginJson.role_name,

        permissions: loginJson.permissions || [],

        // 🔥 THESE ARE CRITICAL
        is_superadmin: Boolean(loginJson.is_superadmin),
        is_tenant_admin: Boolean(loginJson.is_tenant_admin),
        is_admin: Boolean(loginJson.is_admin),
      };

      }

      // Try to fetch subscription from candidate endpoints (some backends return 204)
      const subscriptionCandidates = [
        `${API_URL}/api/subscription/current/`,
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
      if (refreshUser) await refreshUser({ force: true });


      if (VERBOSE) {
        console.log("[Login] loginResponse:", loginJson);
        console.log("[Login] profile fetched from:", profileResult.url, profileResult.status, profileResult.data);
        console.log("[Login] subscription fetched from:", subResult.url, subResult.status, subResult.data);
        console.log("[Login] final persisted profile:", profile);
      }

const infoCode =
  String(loginJson.code || FALLBACK_CODES.LOGIN_SUCCESS);

setMessage(
  loginJson.message ||
  getInfoText(infoCode) ||
  "Login successful"
);
setMessageType("success");


      // Route user as before
    setTimeout(async () => {

 // 1️⃣ Superadmin
if (profile.is_superadmin) {
  navigate("/superadmin/dashboard", { replace: true });
  return;
}

// 2️⃣ Admin by PERMISSION (Tenant admin OR Department admin)
if (
  profile.is_tenant_admin ||
  profile.permissions?.includes("view_manage_user")
) {
  navigate("/admin/dashboard", { replace: true });
  return;
}

      // 3️⃣ NORMAL USER LOGIC (address check)
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
      setMessage(
  getErrorText(FALLBACK_CODES.SERVER_ERROR) ||
  "Server error. Please try again."
);
setMessageType("error");

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

          {message && <p className={`login-message ${messageType === "error" ? "error-text" : "success-text"}`}>{message}</p>}

          <button className="login-button" type="submit">Login</button>
        </form>

        <div className="login-links">
          <p>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          <p>
            Don’t have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
