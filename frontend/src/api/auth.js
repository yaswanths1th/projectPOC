// =====================================================================
// 🔐 SECURE COOKIE-BASED AUTHENTICATION API
// =====================================================================
// ✅ Backend automatically sets HttpOnly cookies
// ✅ React does NOT store tokens in localStorage
// ✅ Tokens are never visible in JavaScript
// =====================================================================

// ⚠️ Development only: Works without HTTPS on localhost
// Change when deploying to production
const API_BASE = "http://127.0.0.1:8000/api/auth";

// =====================================================================
// 🔐 Secure POST wrapper (handles errors & JSON parsing safely)
// =====================================================================
export async function securePost(url, body = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 🔐 CRITICAL: Send cookies automatically
      credentials: "include",
      body: JSON.stringify(body),
    });

    // Safely parse JSON
    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    console.error("API error:", err);
    return {
      ok: false,
      status: 500,
      data: { code: "EA010", message: "Server error" },
    };
  }
}

// =====================================================================
// 🔐 STEP 1 — DIRECT LOGIN (USERNAME + PASSWORD)
// Backend will:
// - Validate credentials
// - Issue JWT tokens
// - Set tokens as HttpOnly cookies
// Returns: User profile data (NOT tokens)
// Sets: access_token & refresh_token cookies (automatic)
// =====================================================================
export async function loginInit(username, password) {
  return securePost("/login-init/", {
    username,
    password,
  });
}

// =====================================================================
// 🔐 VERIFY OTP — DEPRECATED (No longer used)
// =====================================================================
// export async function verifyOTP(session_id, otp) {
//   return securePost("/login-verify-otp/", {
//     session_id,
//     otp,
//   });
// }

// =====================================================================
// 🔐 LOGOUT — Clear cookies & blacklist token
// Backend will:
// - Delete access_token cookie
// - Delete refresh_token cookie
// - Blacklist refresh token
// =====================================================================
export async function logout() {
  return securePost("/logout/");
}

// =====================================================================
// 🔐 GET USER PROFILE
// React should call this after login to:
// - Verify session is valid (cookies exist)
// - Get user data
// - Check permissions
// Backend will read cookies automatically
// =====================================================================
export async function getProfile() {
  try {
    const response = await fetch(`${API_BASE}/profile/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",  // 🔐 Send cookies
    });

    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    console.error("Profile fetch error:", err);
    return {
      ok: false,
      status: 500,
      data: { code: "EA010", message: "Server error" },
    };
  }
}

// =====================================================================
// 🔓 OPTIONAL: Direct JWT login (for admin panel or mobile)
// =====================================================================
export async function loginUser(username, password) {
  return securePost("/login/", {
    username,
    password,
  });
}

// =====================================================================
// 🔓 CHECK USERNAME (AJAX)
// =====================================================================
export async function checkUsername(username) {
  try {
    const response = await fetch(
      `${API_BASE}/check-username/?username=${encodeURIComponent(username)}`
    );
    return await response.json();
  } catch (err) {
    console.error("Check username error:", err);
    return { exists: false };
  }
}

// =====================================================================
// 🔓 CHECK EMAIL (AJAX)
// =====================================================================
export async function checkEmail(email) {
  try {
    const response = await fetch(
      `${API_BASE}/check-email/?email=${encodeURIComponent(email)}`
    );
    return await response.json();
  } catch (err) {
    console.error("Check email error:", err);
    return { exists: false };
  }
}

// =====================================================================
// 📝 REGISTER USER
// =====================================================================
export async function registerUser(userData) {
  return securePost("/register/", userData);
}

