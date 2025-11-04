# GlobeRise Backend - API Documentation

## Table of Contents

1. [Authentication](#authentication)
2. [Refresh Tokens & Logout](#refresh-tokens--logout)
3. [Password Reset](#password-reset)
4. [User Profiles](#user-profiles)
5. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
6. [Session Management](#session-management)
7. [Admin Panel](#admin-panel)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

### Register

**POST** `/api/auth/register`

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "referralCode": "ABCDEFGH" // optional 8-char uppercase code
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "xxx",
      "email": "user@example.com",
      "is_verified": false,
      "role": "USER",
      "two_factor_enabled": false,
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Rate Limit:** 3 registrations per hour per IP

---

### Login

**POST** `/api/auth/login`

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (without 2FA):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Response (with 2FA enabled):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "",
    "requiresTwoFactor": true,
    "tempToken": "eyJhbGc..."
  }
}
```

**Rate Limit:** 5 attempts per 15 minutes per IP

---

### Verify Email

**POST** `/api/auth/verify-email`

Verify email address with the token sent via email.

**Request Body:**

```json
{
  "token": "verification_token_from_email"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": { ... },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Note:** Verification tokens expire after **24 hours**.

**Rate Limit:** 3 requests per hour per IP

---

### Resend Verification Email

**POST** `/api/auth/resend-verification`

Request a new verification email if the previous one expired or was lost.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If an unverified account exists with that email, a new verification email has been sent."
}
```

**Notes:**

- Always returns success message (prevents email enumeration)
- Only works for unverified accounts
- Generates a new token with 24-hour expiry
- Old token becomes invalid

**Rate Limit:** 3 requests per hour per IP

---

### Get Current User

**GET** `/api/auth/me`

Get the authenticated user's information.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "xxx",
      "email": "user@example.com",
      "is_verified": true,
      "role": "USER",
      "two_factor_enabled": false,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

## Refresh Tokens & Logout

### Refresh Access Token

**POST** `/api/auth/refresh`

Exchange a refresh token for a new access token and refresh token (token rotation).

**Request Body:**

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

---

### Logout (Current Device)

**POST** `/api/auth/logout`

Revoke the current refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Logout All Devices

**POST** `/api/auth/logout-all`

Revoke all refresh tokens for the user (logout from all devices).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

## Password Reset

### Request Password Reset

**POST** `/api/auth/forgot-password`

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Rate Limit:** 3 requests per hour per IP

---

### Reset Password

**POST** `/api/auth/reset-password`

Reset password using the token from email.

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please login with your new password."
}
```

**Note:** All existing refresh tokens are revoked for security.

**Rate Limit:** 3 requests per hour per IP

---

## User Profiles

### Get My Profile

**GET** `/api/profile/me`

Get the current user's profile.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "profile": {
      "id": "xxx",
      "userId": "xxx",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "avatarUrl": "https://example.com/avatar.jpg",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "United States",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Update My Profile

**PUT** `/api/profile/me`

Update the current user's profile.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatarUrl": "https://example.com/avatar.jpg",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "United States"
}
```

**Note:** All fields are optional. Only include fields you want to update.

---

### Get User's Public Profile

**GET** `/api/profile/:userId`

Get another user's public profile information.

**Headers:**

```
Authorization: Bearer <access_token>
```

---

## Two-Factor Authentication (2FA)

### Setup 2FA

**POST** `/api/2fa/setup`

Generate a 2FA secret and QR code for Google/Microsoft Authenticator.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "2FA setup initiated. Scan the QR code with your authenticator app and verify with a code to enable.",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "backupCodes": ["A1B2C3D4", "E5F6G7H8", "..."]
  }
}
```

**Important:** Save the backup codes securely! They will not be shown again.

---

### Enable 2FA

**POST** `/api/2fa/enable`

Enable 2FA by verifying a code from the authenticator app.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2FA has been enabled successfully"
}
```

**Rate Limit:** 10 attempts per 15 minutes

---

### Disable 2FA

**POST** `/api/2fa/disable`

Disable 2FA (requires password and 2FA code).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "password": "YourCurrentPassword",
  "token": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2FA has been disabled"
}
```

**Rate Limit:** 10 attempts per 15 minutes

---

### Verify 2FA During Login

**POST** `/api/2fa/verify-login`

Complete login when 2FA is enabled.

**Request Body:**

```json
{
  "tempToken": "temporary_token_from_login",
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2FA verification successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Note:** Use the 6-digit code from your authenticator app OR one of your backup codes.

**Rate Limit:** 10 attempts per 15 minutes

---

### Regenerate Backup Codes

**POST** `/api/2fa/backup-codes/regenerate`

Generate new backup codes (old codes will be invalidated).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "New backup codes generated. Please store them securely.",
  "data": {
    "backupCodes": ["I9J0K1L2", "M3N4O5P6", "..."]
  }
}
```

---

## Session Management

### Get Active Sessions

**GET** `/api/sessions`

Get all active sessions for the current user.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "id": "xxx",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "lastActivityAt": "2025-01-01T00:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "isCurrent": false,
        "device": {
          "browser": "Chrome",
          "os": "Windows",
          "device": "Desktop"
        }
      }
    ]
  }
}
```

---

### Revoke Session

**DELETE** `/api/sessions/:sessionId`

Revoke a specific session (logout from that device).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

## Admin Panel

**Note:** All admin endpoints require the `ADMIN` role.

### Get All Users

**GET** `/api/admin/users`

Get all users with pagination and filtering.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `role` (optional: USER, ADMIN, MODERATOR)
- `verified` (optional: true, false)

**Response:**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [ ... ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

**Rate Limit:** 50 requests per 15 minutes

---

### Get User By ID

**GET** `/api/admin/users/:userId`

Get detailed information about a specific user.

**Headers:**

```
Authorization: Bearer <access_token>
```

---

### Assign Role

**PUT** `/api/admin/users/:userId/role`

Assign a role to a user.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "role": "ADMIN"
}
```

**Valid Roles:** USER, ADMIN, MODERATOR

---

### Delete User

**DELETE** `/api/admin/users/:userId`

Delete a user account.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Note:** Cannot delete your own admin account.

---

### Get System Statistics

**GET** `/api/admin/stats`

Get system statistics.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "stats": {
      "totalUsers": 1000,
      "verifiedUsers": 850,
      "unverifiedUsers": 150,
      "usersWithTwoFactor": 200,
      "usersByRole": {
        "USER": 980,
        "ADMIN": 15,
        "MODERATOR": 5
      },
      "recentUsers": 50
    }
  }
}
```

---

## Rate Limiting

The API implements rate limiting on various endpoints:

- **Login:** 5 attempts per 15 minutes per IP
- **Registration:** 3 registrations per hour per IP
- **Password Reset:** 3 requests per hour per IP
- **Email Verification:** 3 requests per hour per IP
- **2FA Operations:** 10 attempts per 15 minutes per user/IP
- **General API:** 100 requests per 15 minutes per user/IP
- **Admin Operations:** 50 requests per 15 minutes per user

When rate limited, you'll receive a 429 status code with a message indicating when you can try again.

---

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=30d

# Password Reset
PASSWORD_RESET_EXPIRES_IN=1h

# Two-Factor Authentication
TWO_FACTOR_APP_NAME=GlobeRise
```

---

## Token Management Best Practices

1. **Access Token:** Short-lived (7 days by default), stored in memory or secure cookie
2. **Refresh Token:** Long-lived (30 days), stored securely on client
3. **Token Rotation:** New refresh token generated on each refresh
4. **Logout:** Revoke refresh token, access token expires naturally

## Security Features

- ✅ JWT-based authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Email verification
- ✅ Password reset with expiring tokens
- ✅ Two-Factor Authentication (TOTP)
- ✅ Rate limiting on sensitive endpoints
- ✅ Role-based access control (RBAC)
- ✅ Session tracking and management
- ✅ Secure backup codes for 2FA
- ✅ Token rotation for enhanced security

---

## Referrals

### Get My Referral Tree

**GET** `/api/referrals/tree`

Returns your own referral code and up to 16 direct referrals, each with their downline counts.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Referral tree fetched",
  "data": {
    "myCode": "ABCDEFGH",
    "referrals": [
      {
        "id": "childId",
        "email": "child@example.com",
        "directCount": 3,
        "teamCount": 9,
        "teamVolume": 1234.56
      }
    ]
  }
}
```
