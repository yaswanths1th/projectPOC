// =====================================================================
// 🔐 AUTH API — DIRECT LOGIN (No OTP)
// =====================================================================

// Backend URL from env; fallback to localhost
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const BASE_URL = `${API_BASE_URL}/api/auth`;

// Generic POST request with JSON body
async function securePost(url, body = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (error) {
    return { ok: false, data: null };
  }
}

// =====================================================================
// 🔑 LOGIN INIT — Direct Login No OTP
// =====================================================================
export async function loginInit(username, password) {
  return securePost(`${BASE_URL}/login/`, { username, password });
}

// =====================================================================
// 📦 STORE AUTH DATA (UPDATED FOR MULTI-TENANT SAAS)
// =====================================================================
// =====================================================================
// 📦 STORE AUTH DATA (UPDATED FOR MULTI-TENANT SAAS)
// =====================================================================
export function storeAuthData(data) {
  if (data.access) localStorage.setItem("access", data.access);
  if (data.refresh) localStorage.setItem("refresh", data.refresh);

  const userPayload = {
    id: data.id,
    username: data.username,
    email: data.email,

    // Tenant info
    tenant_id: data.tenant_id,
    tenant_slug: data.tenant_slug,
    tenant_name: data.tenant_name,

    // Department / Role
    department_id: data.department_id,
    department_name: data.department_name,
    role_id: data.role_id,
    role_name: data.role_name,

    // Permissions
    permissions: data.permissions || [],

    // Explicit admin flags (important)
    is_superadmin: Boolean(data.is_superadmin),
    is_tenant_admin: Boolean(data.is_tenant_admin),

    // Backwards-compatible shorthand used by some parts of the app
    // Prefer server-provided is_admin but fall back to derived value
    is_admin: typeof data.is_admin !== "undefined" ? Boolean(data.is_admin) : (Boolean(data.is_tenant_admin) && !Boolean(data.is_superadmin)),
  };

  localStorage.setItem("user", JSON.stringify(userPayload));

  if (data.permissions) {
    localStorage.setItem("permissions", JSON.stringify(data.permissions));
  }
}

// =====================================================================
// 🚪 LOGOUT
// =====================================================================
export function logoutUser() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
  localStorage.removeItem("permissions");
}
