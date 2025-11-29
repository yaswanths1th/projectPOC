# 🔐 Cookie-Based Authentication API Reference

## Base URL
```
http://127.0.0.1:8000/api/auth  (Development)
https://yourdomain.com/api/auth  (Production)
```

---

## 🚪 Authentication Endpoints

### 1. Login Init (Step 1 of 2FA)
**Endpoint:** `POST /login-init/`

**Purpose:** Validate credentials and generate OTP

**Request:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "otp_required": true,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "OTP sent to your email"
}
```

**Error Responses:**
```json
// 400 - Missing fields
{"code": "EV001"}

// 401 - Invalid credentials
{"code": "EL001"}

// 403 - User inactive
{"code": "EL002"}

// 429 - Too many attempts
{"code": "GEN003", "error": "Too many requests"}
```

**Rate Limit:** 5 attempts per minute per IP

---

### 2. Login Verify OTP (Step 2 of 2FA)
**Endpoint:** `POST /login-verify-otp/`

**Purpose:** Verify OTP and issue JWT tokens via cookies

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "code": "IL001",
  "message": "Login successful",
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role_id": 2,
  "role_name": "User",
  "permissions": ["read_profile", "edit_profile"],
  "is_admin": false
}
```

**Cookies Set (HttpOnly):**
```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=1800
Set-Cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

**Error Responses:**
```json
// 400 - Missing session_id or OTP
{"code": "EV002"}

// 401 - Invalid session or OTP
{"code": "EL003"}

// 401 - OTP expired (>5 minutes)
{"code": "EL004"}

// 403 - Too many failed attempts (>3)
{"code": "EL005"}
```

**Rate Limit:** 5 attempts per minute per IP

---

### 3. Logout
**Endpoint:** `POST /logout/`

**Purpose:** Clear cookies and logout user

**Authentication Required:** Yes (Bearer token or cookie)

**Request:**
```json
{}
```

**Success Response (200):**
```json
{
  "code": "IL002",
  "message": "Logged out successfully"
}
```

**Cookies Deleted:**
```
Set-Cookie: access_token=; Max-Age=0; HttpOnly; Secure; SameSite=Lax
Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure; SameSite=Lax
```

---

### 4. Token Refresh
**Endpoint:** `POST /token/refresh/`

**Purpose:** Refresh expired access token using refresh token from cookie

**Authentication Required:** No (reads from refresh_token cookie)

**Request:**
```json
{}
```

**Success Response (200):**
```json
{
  "code": "IL003",
  "message": "Token refreshed"
}
```

**New Cookie Set:**
```
Set-Cookie: access_token=<new_jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=1800
```

**Error Response:**
```json
// 401 - Invalid or missing refresh token
{"code": "EL007", "error": "Invalid refresh token"}
```

---

### 5. Profile (Session Check)
**Endpoint:** `GET /profile/`

**Purpose:** Get current user profile (validates session from cookies)

**Authentication Required:** Yes (from access_token cookie)

**Request:**
```
GET /profile/
Cookie: access_token=<jwt>
```

**Success Response (200):**
```json
{
  "id": 1,
  "username": "john_doe",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "is_active": true,
  "date_joined": "2024-01-15T10:30:00Z",
  "department": 1,
  "role": 2,
  "is_staff": false,
  "is_superuser": false,
  "is_admin": false,
  "permissions": ["read_profile", "edit_profile"]
}
```

**Error Response (401):**
```json
{"detail": "Invalid token"}
```

---

### 6. Register
**Endpoint:** `POST /register/`

**Purpose:** Create new user account

**Request:**
```json
{
  "username": "jane_doe",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+1234567890"
}
```

**Success Response (201):**
```json
{
  "code": "IR001",
  "message": "Registration successful"
}
```

**Validation Rules:**
- Username: Alphanumeric only, 3-150 characters
- Email: Valid format, unique
- Password: Min 8 chars, mixed case, numbers, special chars
- Phone: Optional, max 15 chars

**Error Responses:**
```json
// 400 - Validation failed
{
  "username": ["Username must be alphanumeric"],
  "email": ["Invalid email format"],
  "password": ["Password too weak"]
}
```

---

## 👤 User Management Endpoints

### 7. Get User Profile (Current)
**Endpoint:** `PUT /profile/`

**Purpose:** Update current user profile

**Authentication Required:** Yes

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890"
}
```

**Response (200):**
```json
{
  "code": "IP001",
  "message": "Profile updated"
}
```

**Note:** `role` and `department` cannot be changed by regular users

---

### 8. Check Username (AJAX)
**Endpoint:** `GET /check-username/?username=john_doe`

**Purpose:** Check if username is available (for registration form)

**Response (200):**
```json
{
  "exists": false
}
```

---

### 9. Check Email (AJAX)
**Endpoint:** `GET /check-email/?email=john@example.com`

**Purpose:** Check if email is available

**Response (200):**
```json
{
  "exists": false
}
```

---

## 👑 Admin Endpoints

### 10. List Users (Admin Only)
**Endpoint:** `GET /admin/users/`

**Purpose:** Get all users (with pagination)

**Authentication Required:** Yes (admin role only)

**Response (200):**
```json
[
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role_id": 2,
    "role_name": "User",
    "is_active": true,
    "date_joined": "2024-01-15T10:30:00Z"
  }
]
```

**Error (403):**
```json
{"detail": "Admin access required"}
```

---

### 11. Create User (Admin Only)
**Endpoint:** `POST /admin/users/`

**Purpose:** Create new user (admin assigns role/department)

**Authentication Required:** Yes (admin role only)

**Request:**
```json
{
  "username": "new_user",
  "email": "new@example.com",
  "password": "SecurePass123!",
  "first_name": "New",
  "last_name": "User",
  "department": 1,
  "role": 2,
  "is_active": true
}
```

**Response (201):**
```json
{
  "code": "IR001",
  "id": 5
}
```

---

### 12. Update User (Admin Only)
**Endpoint:** `PUT /admin/users/<id>/`

**Purpose:** Update user details

**Authentication Required:** Yes (admin only)

**Request:**
```json
{
  "first_name": "Updated",
  "is_active": true
}
```

**Response (200):**
```json
{
  "code": "IP001",
  "message": "User updated"
}
```

---

### 13. Delete User (Admin Only)
**Endpoint:** `DELETE /admin/users/<id>/`

**Purpose:** Delete user

**Authentication Required:** Yes (admin only)

**Response (200):**
```json
{
  "code": "ID001",
  "message": "User deleted"
}
```

---

### 14. Toggle User Active (Admin Only)
**Endpoint:** `POST /admin/users/<id>/toggle/`

**Purpose:** Activate or deactivate user

**Authentication Required:** Yes (admin only)

**Response (200):**
```json
{
  "code": "IP001",
  "message": "User status updated"
}
```

---

### 15. User Stats (Admin Only)
**Endpoint:** `GET /admin/stats/`

**Purpose:** Get user statistics

**Authentication Required:** Yes (admin only)

**Response (200):**
```json
{
  "total_users": 10,
  "active_users": 8,
  "inactive_users": 2
}
```

---

## 🏢 Department Endpoints

### 16. List Departments
**Endpoint:** `GET /departments/`

**Purpose:** Get all departments

**Response (200):**
```json
[
  {
    "id": 1,
    "department_name": "General",
    "is_active": true
  }
]
```

---

### 17. Create Department (Admin Only)
**Endpoint:** `POST /departments/`

**Request:**
```json
{
  "department_name": "Engineering",
  "is_active": true
}
```

**Response (201):**
```json
{
  "id": 2,
  "department_name": "Engineering",
  "is_active": true
}
```

---

### 18. Update Department (Admin Only)
**Endpoint:** `PUT /departments/<id>/`

---

### 19. Delete Department (Admin Only)
**Endpoint:** `DELETE /departments/<id>/`

---

### 20. Toggle Department (Admin Only)
**Endpoint:** `POST /departments/<id>/toggle/`

---

## 🧩 Role Endpoints

### 21. List Roles
**Endpoint:** `GET /roles/`

### 22. Create Role (Admin Only)
**Endpoint:** `POST /roles/`

### 23. Update Role (Admin Only)
**Endpoint:** `PUT /roles/<id>/`

### 24. Delete Role (Admin Only)
**Endpoint:** `DELETE /roles/<id>/`

### 25. Toggle Role (Admin Only)
**Endpoint:** `POST /roles/<id>/toggle/`

---

## 💬 Messages Endpoints

### 26. Get Messages
**Endpoint:** `GET /messages/`

**Purpose:** Get all system messages (errors, validations, info)

**Response (200):**
```json
{
  "user_error": [
    {"error_code": "EL001", "error_message": "Invalid credentials"}
  ],
  "user_validation": [
    {"validation_code": "EV001", "validation_message": "Username required"}
  ],
  "user_information": [
    {"information_code": "IL001", "information_text": "Login successful"}
  ]
}
```

---

## 📧 Credentials Email

### 27. Send User Credentials (Admin Only)
**Endpoint:** `POST /send-user-credentials/`

**Purpose:** Email login credentials to user

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "TempPassword123!"
}
```

**Response (200):**
```json
{
  "code": "IG001",
  "message": "Credentials sent"
}
```

---

## 🔐 Permissions Endpoints

See `urls_permissions.py` for detailed permissions API

---

## 🔑 Authentication Headers

### Cookie-Based (NEW)
```
GET /profile/
Cookie: access_token=eyJhbGciOiJIUzI1NiIs...
```

### Legacy Bearer Token (Still supported)
```
GET /profile/
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## ⏰ Token Lifetimes

- **Access Token:** 30 minutes
- **Refresh Token:** 24 hours
- **OTP:** 5 minutes
- **Rate Limit Window:** 60 seconds per IP per endpoint

---

## 🚨 Error Codes

| Code | Meaning | Status |
|------|---------|--------|
| EV001 | Missing required fields | 400 |
| EV002 | Invalid input format | 400 |
| EL001 | Invalid credentials | 401 |
| EL002 | User inactive | 403 |
| EL003 | Invalid/expired OTP | 401 |
| EL004 | OTP expired | 401 |
| EL005 | Too many OTP attempts | 403 |
| EL006 | Missing refresh token | 401 |
| EL007 | Invalid refresh token | 401 |
| GEN001 | Not found | 404 |
| GEN002 | Server error | 500 |
| GEN003 | Rate limit exceeded | 429 |
| IR001 | Registration/Creation successful | 201 |
| IL001 | Login successful | 200 |
| IL002 | Logout successful | 200 |
| IL003 | Token refreshed | 200 |
| IP001 | Update successful | 200 |
| ID001 | Delete successful | 200 |
| IG001 | Email sent | 200 |

---

## 🛡️ Security Headers

All responses include:
```
CORS-Allow-Credentials: true
CORS-Allow-Origin: http://localhost:5173
Set-Cookie: ... ; HttpOnly; Secure; SameSite=Lax
```

---

## 📝 Example Frontend Usage

### Login
```javascript
const result = await loginInit("john_doe", "password");
if (result.ok) {
  navigate("/verify-otp", { state: { session_id: result.data.session_id } });
}
```

### Verify OTP
```javascript
const result = await verifyOTP(sessionId, "123456");
// Cookies automatically set by backend
navigate("/dashboard");
```

### Get Profile
```javascript
const response = await getProfile();
// Cookies automatically sent
console.log(response.data.permissions);
```

### Logout
```javascript
await logout();
// Cookies automatically deleted by backend
navigate("/login");
```

---

**Last Updated:** 2024-11-27
**Version:** 1.0.0 (Cookie-Based Auth)
