// =====================================================================
// 🔐 LOGIN PAGE (Direct Login - No OTP)
// =====================================================================

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { loginInit } from "../api/auth";
import "./LoginPage.css";

const FALLBACK_CODES = {
  LOGIN_FAILED: "EL001",
  SERVER_ERROR: "EA010",
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("");

  const [msgTables, setMsgTables] = useState({
    user_error: {},
    user_information: {},
    user_validation: {},
  });

  const navigate = useNavigate();

  // ============================================================
  // Load Message Tables From localStorage
  // ============================================================
  const normalize = (arr, type) => {
    const map = {};
    if (!Array.isArray(arr)) return map;

    arr.forEach((item) => {
      if (!item) return;

      if (type === "error" && item.error_code)
        map[item.error_code.toUpperCase()] = item.error_message;

      if (type === "info" && item.information_code)
        map[item.information_code.toUpperCase()] = item.information_text;

      if (type === "validation" && item.validation_code)
        map[item.validation_code.toUpperCase()] = item.validation_message;
    });

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
    msgTables.user_error[(code || "").toUpperCase()] ||
    "Invalid credentials.";

  // ============================================================
  // 🔐 LOGIN HANDLER — FIXED (NO result.json())
  // ============================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setType("");

    if (!username.trim() || !password.trim()) {
      setMessage("Username and password are required.");
      setType("error");
      return;
    }

    try {
      const result = await loginInit(username, password);
      const { ok, data } = result;

      // Invalid credentials
      if (!ok) {
        const msg = getErrorText(data?.code || FALLBACK_CODES.LOGIN_FAILED);
        setMessage(msg);
        setType("error");
        return;
      }

      // Successful login - redirect to dashboard
      setMessage("Login successful!");
      setType("success");
      setTimeout(() => {
        navigate(data?.is_admin ? "/admin/dashboard" : "/dashboard", {
          replace: true,
        });
      }, 500);

    } catch (err) {
      setMessage(getErrorText(FALLBACK_CODES.SERVER_ERROR));
      setType("error");
    }
  };

  // ============================================================
  // UI Rendering
  // ============================================================
  return (
    <div className="auth-wrapper">
      <div className="login-container">
        <h2>Login</h2>

        <form onSubmit={handleLogin} className="login-form">
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
            <p className={type === "error" ? "error-text" : "success-text"}>
              {message}
            </p>
          )}

          <button className="login-button">Next</button>
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
