// frontend/src/pages/LoginPage.jsx

import { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "./LoginPage.css";
import { UserContext } from "../context/UserContext";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // error | success
  const navigate = useNavigate();

  const [msgTables, setMsgTables] = useState({
    user_error: {},
    user_information: {},
    user_validation: {},
  });

  // -------------------------------
  // Normalize DB message tables
  // -------------------------------
  const normalize = (maybeArr, type) => {
    if (!maybeArr) return {};
    const map = {};
    if (Array.isArray(maybeArr)) {
      for (const item of maybeArr) {
        if (!item) continue;
        if (type === "error" && item.error_code)
          map[item.error_code.toUpperCase()] = item.error_message || "";
        if (type === "info" && item.information_code)
          map[item.information_code.toUpperCase()] = item.information_text || "";
        if (type === "validation" && item.validation_code)
          map[item.validation_code.toUpperCase()] = item.validation_message || "";
      }
    }
    return map;
  };

  useEffect(() => {
    try {
      const e = JSON.parse(localStorage.getItem("user_error") || "[]");
      const i = JSON.parse(localStorage.getItem("user_information") || "[]");
      const v = JSON.parse(localStorage.getItem("user_validation") || "[]");

      setMsgTables({
        user_error: normalize(e, "error"),
        user_information: normalize(i, "info"),
        user_validation: normalize(v, "validation"),
      });
    } catch {
      setMsgTables({ user_error: {}, user_information: {}, user_validation: {} });
    }
  }, []);

  const getErrorText = (code) =>
    msgTables.user_error[(code || "").toUpperCase()] || "";

  const getInfoText = (code) =>
    msgTables.user_information[(code || "").toUpperCase()] || "";

  // -------------------------------
  // LOGIN HANDLER (COOKIE-BASED)
  // -------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/login/", {
        method: "POST",
        credentials: "include", // IMPORTANT for cookies
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));
      console.log("LOGIN RESPONSE:", data);


      // -------------------------
      // INVALID CREDENTIALS
      // -------------------------
      if (!res.ok || !data.username) {
        const code = data.code || "EL001";
        const text =
          data.message ||
          getErrorText(code) ||
          "Invalid username or password.";

        setMessage(text);
        setMessageType("error");
        return;
      }

      // -------------------------
      // SUCCESS MESSAGE
      // -------------------------
      const infoCode = data.code || "IL001";
      const successText =
        data.message ||
        getInfoText(infoCode) ||
        "Login successful.";

      setMessage(successText);
      setMessageType("success");

      // -------------------------
      // STORE USER (no tokens!)
      // -------------------------
      localStorage.setItem(
        "user",
        JSON.stringify({
          username: data.username,
          email: data.email,
          role_id: data.role_id,
          role_name: data.role_name,
          is_admin: data.is_admin,
          permissions: data.permissions,
        })
      );

      // -------------------------
      // FORCE PASSWORD CHANGE
      // -------------------------
      if (data.force_password_change === true) {
        setTimeout(() => {
          navigate("/change-password", { replace: true });
        }, 700);
        return;
      }

      // -------------------------
      // ROLE-BASED REDIRECT
      // -------------------------
      setTimeout(async () => {
  console.log("Redirect check:", data);

  const roleId = Number(data.role_id);

  // If backend didn't send role_id → treat as user
  if (isNaN(roleId)) {
    navigate("/dashboard", { replace: true });
    return;
  }

  // ADMIN = any role_id except 2
  if (roleId !== 2) {
    navigate("/admin/dashboard", { replace: true });
    return;
  }

  // USER = role_id === 2 → check address
  try {
    const addrRes = await fetch("http://127.0.0.1:8000/api/addresses/check/", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const addrData = await addrRes.json();
    console.log("Address check:", addrData);

    if (addrRes.ok && addrData.has_address) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/addresses", { replace: true });
    }
  } catch {
    navigate("/addresses", { replace: true });
  }
}, 700);

    } catch {
      let fallback = getErrorText("EA010");
      if (!fallback) fallback = "Unable to reach server. Please try again.";

      setMessage(fallback);
      setMessageType("error");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="login-container">
        <h2>Login</h2>

        <form onSubmit={handleLogin} className="login-form" noValidate>
          <input
            className="login-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <div className="password-wrapper">
            <input
              className="login-input"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </span>
          </div>

          {message && (
            <p
              className={`login-message ${
                messageType === "error" ? "error-text" : "success-text"
              }`}
            >
              {message}
            </p>
          )}

          <button className="login-button" type="submit">
            Login
          </button>
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

export default LoginPage;
