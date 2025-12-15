# GlobeRise Backend API Documentation

> **Version:** 1.0.0  
> **Base URL:** `http://localhost:6969/api`  
> **Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Codes](#error-codes)
5. [API Endpoints](#api-endpoints)
   - [Health Check](#health-check)
   - [Auth Module](#auth-module)
   - [Profile Module](#profile-module)
   - [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
   - [Sessions Module](#sessions-module)
   - [Dashboard Module](#dashboard-module)
   - [Wallets Module](#wallets-module)
   - [Investments Module](#investments-module)
   - [Referrals Module](#referrals-module)
   - [Transactions Module](#transactions-module)
   - [Withdrawals Module](#withdrawals-module)
   - [Admin Module](#admin-module)
   - [Config Module (Admin)](#config-module-admin)
   - [Reports Module (Admin)](#reports-module-admin)
6. [Enums & Types](#enums--types)
7. [Scheduled Jobs](#scheduled-jobs)

---

## Overview

GlobeRise is a DeFi and MLM platform backend built on Node.js/Express with PostgreSQL. The system implements:

- **3-Wallet Architecture**: Deposit, Staking, Reward, Withdrawal wallets
- **MLM Income System**: ROI, Direct Bonus, Level Income, Rank Bonus, Royalty
- **Blockchain Integration**: Sepolia testnet smart contracts

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Types

| Token | Expiry | Purpose |
|-------|--------|---------|
| Access Token | 1 hour | API authentication |
| Refresh Token | 7 days | Obtain new access token |
| Temp Token | 5 minutes | 2FA verification flow |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (Invalid/Missing Token) |
| 403 | Forbidden (Insufficient Permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (Rate Limited) |
| 500 | Internal Server Error |

---

## API Endpoints

---

### Health Check

#### `GET /api/health`

Check if the server is running.

**Authentication:** `<none>`

**Response:**

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-11-26T12:00:00.000Z"
}
```

---

### Auth Module

Base path: `/api/auth`

---

#### `POST /api/auth/register`

Register a new user with email and password.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "referralCode": "ABC12345"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | Yes | Valid email format |
| password | string | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| referralCode | string | No | Exactly 8 uppercase alphanumeric characters |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "clxyz123...",
      "email": "user@example.com",
      "is_verified": false,
      "role": "USER",
      "two_factor_enabled": false,
      "created_at": "2025-11-26T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses:**

- `400` - Email already registered
- `400` - Validation error (invalid email/password format)
- `400` - Referrer has reached 16 direct referrals limit
- `400` - Referrer is dormant

---

#### `POST /api/auth/login`

Login with email and password.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clxyz123...",
      "email": "user@example.com",
      "is_verified": true,
      "role": "USER",
      "two_factor_enabled": false,
      "created_at": "2025-11-26T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**2FA Required Response (200):**

```json
{
  "success": true,
  "message": "2FA verification required",
  "data": {
    "requiresTwoFactor": true,
    "tempToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses:**

- `401` - Invalid email or password

---

#### `POST /api/auth/verify-email`

Verify email address with token sent via email.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "token": "verification_token_from_email"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| token | string | Yes | 32-128 characters |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses:**

- `400` - Invalid or expired verification token

---

#### `POST /api/auth/resend-verification`

Resend email verification link.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "If an unverified account exists with that email, a new verification email has been sent."
}
```

---

#### `POST /api/auth/forgot-password`

Request password reset email.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

---

#### `POST /api/auth/reset-password`

Reset password using token from email.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please login with your new password."
}
```

**Error Responses:**

- `400` - Invalid or expired reset token
- `400` - Password does not meet requirements

---

#### `GET /api/auth/google`

Initiate Google OAuth flow.

**Authentication:** `<none>`

**Response:** Redirects to Google OAuth consent screen.

---

#### `GET /api/auth/google/callback`

Google OAuth callback handler.

**Authentication:** `<none>`

**Response:** Redirects to frontend with token:
- Success: `{FRONTEND_URL}/auth/callback?token={jwt_token}`
- Error: `{FRONTEND_URL}/login?error=oauth_failed`

---

#### `GET /api/auth/me`

Get current authenticated user.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "clxyz123...",
      "email": "user@example.com",
      "is_verified": true,
      "role": "USER",
      "two_factor_enabled": false,
      "created_at": "2025-11-26T12:00:00.000Z"
    }
  }
}
```

**Error Responses:**

- `401` - Invalid or expired token

---

#### `POST /api/auth/refresh`

Refresh access token using refresh token.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):**

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

**Error Responses:**

- `400` - Refresh token is required
- `401` - Invalid or revoked refresh token

---

#### `POST /api/auth/logout`

Logout and revoke current refresh token.

**Authentication:** `<none>`

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### `POST /api/auth/logout-all`

Logout from all devices (revoke all refresh tokens).

**Authentication:** JWT Required

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

### Profile Module

Base path: `/api/profile`

All routes require JWT authentication.

---

#### `GET /api/profile/me`

Get current user's profile.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "profile": {
      "id": "clxyz123...",
      "userId": "clxyz456...",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "avatarUrl": "https://example.com/avatar.jpg",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "updatedAt": "2025-11-26T12:00:00.000Z"
    }
  }
}
```

---

#### `PUT /api/profile/me`

Update current user's profile.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatarUrl": "https://example.com/avatar.jpg",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA"
}
```

All fields are optional.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": { ... }
  }
}
```

---

#### `GET /api/profile/:userId`

Get another user's public profile.

**Authentication:** JWT Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | Target user's ID |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  }
}
```

**Error Responses:**

- `404` - Profile not found

---

### Two-Factor Authentication (2FA)

Base path: `/api/2fa`

---

#### `POST /api/2fa/setup`

Setup 2FA (generate secret and QR code).

**Authentication:** JWT Required

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "2FA setup initiated. Scan the QR code with your authenticator app and verify with a code to enable.",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "backupCodes": [
      "ABC123DEF456",
      "GHI789JKL012",
      ...
    ]
  }
}
```

---

#### `POST /api/2fa/enable`

Enable 2FA after verifying a token.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "token": "123456"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "2FA has been enabled successfully"
}
```

**Error Responses:**

- `400` - Invalid 2FA token

---

#### `POST /api/2fa/disable`

Disable 2FA.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "password": "YourPassword123",
  "token": "123456"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "2FA has been disabled"
}
```

**Error Responses:**

- `400` - Invalid password or 2FA token

---

#### `POST /api/2fa/verify-login`

Verify 2FA code during login flow.

**Authentication:** `<none>` (uses tempToken)

**Request Body:**

```json
{
  "tempToken": "temporary_token_from_login",
  "code": "123456"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "2FA verification successful",
  "data": {
    "user": { ... },
    "token": "access_token",
    "refreshToken": "refresh_token"
  }
}
```

**Error Responses:**

- `401` - Invalid 2FA code

---

#### `POST /api/2fa/backup-codes/regenerate`

Regenerate backup codes.

**Authentication:** JWT Required

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "New backup codes generated. Please store them securely.",
  "data": {
    "backupCodes": [
      "ABC123DEF456",
      "GHI789JKL012",
      ...
    ]
  }
}
```

---

### Sessions Module

Base path: `/api/sessions`

All routes require JWT authentication.

---

#### `GET /api/sessions`

Get all active sessions for current user.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "id": "clxyz123...",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "lastActivityAt": "2025-11-26T12:00:00.000Z",
        "createdAt": "2025-11-26T10:00:00.000Z",
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

#### `DELETE /api/sessions/:sessionId`

Revoke a specific session.

**Authentication:** JWT Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | string | Session ID to revoke |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

**Error Responses:**

- `404` - Session not found
- `403` - Cannot revoke another user's session

---

### Dashboard Module

Base path: `/api/dashboard`

All routes require JWT authentication.

---

#### `GET /api/dashboard/stats`

Get dashboard statistics for current user.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Dashboard stats retrieved",
  "data": {
    "rank": "NAVIGATOR",
    "totalEarnings": "48896.61",
    "teamBusiness": "150000.00",
    "directBusiness": "25000.00",
    "lastMonthBusiness": "120000.00",
    "walletBalances": {
      "fiat": "100000.00",
      "deposit": "50000.00",
      "staking": "0.00",
      "reward": "50000.00",
      "withdrawal": "0.00"
    }
  }
}
```

---

#### `GET /api/dashboard/chart`

Get earnings chart data (last 7 days).

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Chart data retrieved",
  "data": [
    { "date": "2025-11-20", "amount": "1250.00" },
    { "date": "2025-11-21", "amount": "1340.00" },
    { "date": "2025-11-22", "amount": "980.00" },
    { "date": "2025-11-23", "amount": "1500.00" },
    { "date": "2025-11-24", "amount": "1200.00" },
    { "date": "2025-11-25", "amount": "1100.00" },
    { "date": "2025-11-26", "amount": "1450.00" }
  ]
}
```

---

### Wallets Module

Base path: `/api/wallets`

All routes require JWT authentication.

---

#### `GET /api/wallets`

Get all wallet balances for current user.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Wallet balances retrieved",
  "data": {
    "fiat": "100000.00",
    "deposit": "50000.00",
    "staking": "0.00",
    "reward": "50000.00",
    "withdrawal": "0.00"
  }
}
```

---

#### `POST /api/wallets/transfer`

Transfer funds between wallets.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "fromWallet": "REWARD",
  "toWallet": "DEPOSIT",
  "amount": 1000
}
```

**Allowed Transfer Paths:**

| From | To | Purpose |
|------|----|---------| 
| REWARD | DEPOSIT | Re-invest (Compound) |
| REWARD | WITHDRAWAL | Prepare for cashout |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Transfer successful"
}
```

**Error Responses:**

- `400` - Invalid transfer path
- `400` - Insufficient balance

---

#### `POST /api/wallets/admin/credit`

Admin manual credit to user wallet.

**Authentication:** JWT Required + Admin Role

**Request Body:**

```json
{
  "userId": "clxyz123...",
  "wallet": "FIAT",
  "amount": 10000
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| userId | string | Yes | Target user ID |
| wallet | string | Yes | DEPOSIT, STAKING, REWARD, WITHDRAWAL |
| amount | number | Yes | Amount to credit |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Credit successful"
}
```

---

### Investments Module

Base path: `/api/investments`

All routes require JWT authentication.

---

#### `POST /api/investments/package`

Create a new MLM investment package.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "amount": 5000
}
```

**Business Rules:**

- Amount deducted from Fiat Wallet
- Credited to Deposit Wallet
- 5% Direct Bonus sent to referrer's Reward Wallet
- Progressive Rule: Cannot invest less than previous investment
- Downline Rule: Cannot invest more than referrer's investment

**Success Response (200):**

```json
{
  "success": true,
  "message": "Package purchased successfully",
  "data": {
    "id": "clxyz123...",
    "userId": "clxyz456...",
    "amount": "5000.00",
    "type": "PACKAGE",
    "status": "ACTIVE",
    "roiRate": "8.00",
    "durationDays": 30,
    "startDate": "2025-11-26T12:00:00.000Z",
    "createdAt": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

- `400` - Insufficient Fiat balance
- `400` - Amount less than previous investment (Progressive Rule)
- `400` - Amount greater than referrer's investment (Downline Rule)

---

#### `POST /api/investments/fixed`

Create a fixed-term staking deposit.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "amount": 10000,
  "durationMonths": 6
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| amount | number | Yes | Investment amount |
| durationMonths | number | Yes | 3, 6, 12, 18, 24 |

**Staking Tiers:**

| Duration | Monthly Rate |
|----------|--------------|
| 3 months | 1.25% |
| 6 months | 1.75% |
| 12 months | 2.25% |
| 18 months | 4.00% |
| 24 months | 4.75% |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Fixed deposit created successfully",
  "data": {
    "id": "clxyz123...",
    "userId": "clxyz456...",
    "amount": "10000.00",
    "type": "FIXED",
    "status": "ACTIVE",
    "roiRate": "1.75",
    "durationDays": 180,
    "startDate": "2025-11-26T12:00:00.000Z",
    "endDate": "2026-05-26T12:00:00.000Z",
    "createdAt": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

- `400` - Insufficient Fiat balance
- `400` - Invalid duration tier

---

#### `GET /api/investments/my`

Get investment history for current user.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Investment history retrieved",
  "data": [
    {
      "id": "clxyz123...",
      "amount": "5000.00",
      "type": "PACKAGE",
      "status": "ACTIVE",
      "roiRate": "8.00",
      "durationDays": 30,
      "startDate": "2025-11-26T12:00:00.000Z",
      "lastRoiDate": "2025-11-25T00:00:00.000Z",
      "endDate": null,
      "createdAt": "2025-11-26T12:00:00.000Z",
      "totalRoiPaid": "1200.00"
    }
  ]
}
```

---

### Referrals Module

Base path: `/api/referrals`

---

#### `GET /api/referrals/tree`

Get referral tree (upline + direct downlines with stats).

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Referral tree fetched",
  "data": {
    "myCode": "ABC12345",
    "myName": "John Doe",
    "upline": {
      "id": "clxyz123...",
      "email": "sponsor@example.com",
      "name": "Jane Smith",
      "rank": "NAVIGATOR",
      "totalDownlines": 45
    },
    "referrals": [
      {
        "id": "clxyz456...",
        "email": "referral1@example.com",
        "name": "Bob Wilson",
        "rank": "EXPLORER",
        "joinedAt": "2025-11-20T12:00:00.000Z",
        "directCount": 5,
        "teamCount": 23,
        "totalTeamBusiness": "75000.00",
        "lastMonthBusiness": "60000.00"
      }
    ]
  }
}
```

**Notes:**

- Maximum 16 direct referrals per user
- `teamCount` includes all downlines recursively
- `totalTeamBusiness` is live calculated

---

### Transactions Module

Base path: `/api/transactions`

All routes require JWT authentication.

---

#### `GET /api/transactions/my`

Get transaction history with filters and pagination.

**Authentication:** JWT Required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| type | string | ALL | Filter by type |
| wallet | string | ALL | Filter by wallet |

**Type Filter Values:**

- `ALL` - All transactions
- `ROI` - ROI payouts
- `COMMISSION` - Direct/Level commissions
- `ROYALTY` - Monthly royalty
- `RANK_BONUS` - Rank achievement bonus
- `REWARDS` - All reward types combined
- `TRANSFER` - Internal transfers
- `INVESTMENT` - Package/Fixed purchases
- `WITHDRAWAL` - Withdrawal requests
- `DEPOSIT` - External deposits

**Wallet Filter Values:**

- `ALL`, `DEPOSIT`, `STAKING`, `REWARD`, `WITHDRAWAL`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Transaction history retrieved",
  "data": {
    "transactions": [
      {
        "id": "clxyz123...",
        "amount": "400.00",
        "type": "ROI",
        "status": "COMPLETED",
        "sourceWallet": null,
        "destWallet": "REWARD",
        "description": "Monthly ROI (8%)",
        "referenceId": "investment_id",
        "referenceType": "INVESTMENT",
        "metadata": { "roiRate": 8 },
        "createdAt": "2025-11-26T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

---

#### `GET /api/transactions/earnings`

Get earnings summary breakdown by type.

**Authentication:** JWT Required

**Success Response (200):**

```json
{
  "success": true,
  "message": "Earnings summary retrieved",
  "data": {
    "breakdown": {
      "ROI": { "total": "24000.00", "count": 60 },
      "COMMISSION": { "total": "15000.00", "count": 120 },
      "ROYALTY": { "total": "5000.00", "count": 6 },
      "RANK_BONUS": { "total": "3000.00", "count": 2 },
      "STAKING_RETURN": { "total": "1896.61", "count": 3 }
    },
    "totalEarnings": "48896.61"
  }
}
```

---

### Withdrawals Module

Base path: `/api/withdrawals`

---

#### `POST /api/withdrawals/request`

Request a withdrawal.

**Authentication:** JWT Required

**Request Body:**

```json
{
  "amount": 1000
}
```

**Business Rules:**

- Withdrawals only processed on Mondays (UTC)
- Amount deducted from Withdrawal Wallet
- Minimum withdrawal amount applies (from PlanConfig)
- Requires admin approval

**Success Response (200):**

```json
{
  "success": true,
  "message": "Withdrawal requested successfully",
  "data": {
    "id": "clxyz123...",
    "amount": "1000.00",
    "type": "WITHDRAWAL",
    "status": "PENDING",
    "createdAt": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

- `400` - Withdrawals only open on Mondays (UTC)
- `400` - Insufficient Withdrawal Wallet balance
- `400` - Amount below minimum withdrawal

---

#### `GET /api/withdrawals/pending`

Get all pending withdrawal requests (Admin).

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Pending withdrawals retrieved",
  "data": {
    "withdrawals": [
      {
        "id": "clxyz123...",
        "userId": "clxyz456...",
        "amount": "1000.00",
        "status": "PENDING",
        "createdAt": "2025-11-26T12:00:00.000Z",
        "user": {
          "email": "user@example.com"
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

#### `POST /api/withdrawals/:transactionId/approve`

Approve a withdrawal request (Admin).

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| transactionId | string | Withdrawal transaction ID |

**Request Body:**

```json
{
  "feePercentage": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| feePercentage | number | No | Override default fee (from PlanConfig) |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Withdrawal approved successfully",
  "data": {
    "grossAmount": "1000.00",
    "feeAmount": "100.00",
    "netAmount": "900.00"
  }
}
```

**Error Responses:**

- `404` - Transaction not found
- `400` - Transaction is not pending

---

#### `POST /api/withdrawals/:transactionId/reject`

Reject a withdrawal request (Admin).

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| transactionId | string | Withdrawal transaction ID |

**Request Body:**

```json
{
  "reason": "Suspicious activity detected"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Withdrawal rejected successfully",
  "data": {
    "refundedAmount": "1000.00"
  }
}
```

---

### Admin Module

Base path: `/api/admin`

All routes require JWT authentication + Admin role.

---

#### `GET /api/admin/users`

Get all users with pagination and filters.

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| role | string | - | Filter by role (USER, ADMIN, MODERATOR) |
| verified | boolean | - | Filter by verification status |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "clxyz123...",
        "email": "user@example.com",
        "role": "USER",
        "is_verified": true,
        "two_factor_enabled": false,
        "rank": "NAVIGATOR",
        "created_at": "2025-11-26T12:00:00.000Z",
        "updated_at": "2025-11-26T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

#### `GET /api/admin/users/:userId`

Get user details by ID.

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID |

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "clxyz123...",
      "email": "user@example.com",
      "role": "USER",
      "is_verified": true,
      "two_factor_enabled": false,
      "google_id": null,
      "rank": "NAVIGATOR",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T12:00:00.000Z",
      "profile": { ... },
      "rankHistory": [
        {
          "rank": "EXPLORER",
          "achievedAt": "2025-10-15T12:00:00.000Z",
          "totalBusiness": "5000.00",
          "strongestLeg": "3000.00",
          "otherLegs": "2000.00"
        }
      ]
    }
  }
}
```

---

#### `PUT /api/admin/users/:userId/role`

Assign role to user.

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID |

**Request Body:**

```json
{
  "role": "MODERATOR"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| role | string | Yes | USER, ADMIN, MODERATOR |

**Success Response (200):**

```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "user": {
      "id": "clxyz123...",
      "email": "user@example.com",
      "role": "MODERATOR",
      "is_verified": true,
      "created_at": "2025-11-26T12:00:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Invalid role
- `400` - Cannot remove your own admin privileges
- `404` - User not found

---

#### `DELETE /api/admin/users/:userId`

Delete a user.

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID |

**Success Response (200):**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses:**

- `400` - Cannot delete your own account
- `404` - User not found

---

#### `GET /api/admin/stats`

Get system statistics.

**Authentication:** JWT Required + Admin Role

**Success Response (200):**

```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "stats": {
      "totalUsers": 1500,
      "verifiedUsers": 1200,
      "unverifiedUsers": 300,
      "usersWithTwoFactor": 450,
      "usersByRole": {
        "USER": 1480,
        "ADMIN": 5,
        "MODERATOR": 15
      },
      "recentUsers": 125
    }
  }
}
```

---

#### `POST /api/admin/roi/trigger`

Manually trigger monthly ROI calculation.

**Authentication:** JWT Required + Admin Role

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Daily ROI processed successfully",
  "data": {
    "processedCount": 450,
    "totalPayout": "36000.00"
  }
}
```

---

#### `POST /api/admin/rank/trigger`

Manually trigger daily rank check.

**Authentication:** JWT Required + Admin Role

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Rank Engine executed successfully"
}
```

---

#### `POST /api/admin/royalty/trigger`

Manually trigger monthly royalty distribution.

**Authentication:** JWT Required + Admin Role

**Request Body:** `<none>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Royalty Engine executed successfully"
}
```

---

#### `GET /api/admin/debug/chain-user/:address`

Debug: Fetch on-chain user info from smart contract.

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| address | string | Wallet address (0x...) |

**Success Response (200):**

```json
{
  "success": true,
  "message": "On-chain user info retrieved",
  "data": {
    "address": "0x1234567890abcdef...",
    "rankName": "NAVIGATOR",
    "withdrawableBalance": "5000.00",
    "isDormant": false,
    "investments": [
      {
        "amount": "10000000000000000000000",
        "startTime": 1700000000,
        "passiveROIClaimed": "800000000000000000000",
        "maxClaimable": "30000000000000000000000",
        "referrer": "0x...",
        "active": true
      }
    ],
    "stakes": []
  }
}
```

**Error Responses:**

- `400` - Blockchain service is not connected

---

### Config Module (Admin)

Base path: `/api/config`

All routes require JWT authentication + Admin role.

---

#### `GET /api/config/plan`

Get global plan configuration.

**Authentication:** JWT Required + Admin Role

**Success Response (200):**

```json
{
  "success": true,
  "message": "Plan configuration retrieved",
  "data": {
    "id": "clxyz123...",
    "key": "GLOBAL_SETTINGS",
    "levelIncomeRates": {
      "1": 10, "2": 5, "3": 4, "4": 4, "5": 3,
      "6": 3, "7": 3, "8": 2, "9": 2, "10": 2,
      "11": 2, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1
    },
    "withdrawalFeePercent": "10.00",
    "minWithdrawalAmount": "10.00",
    "updatedAt": "2025-11-26T12:00:00.000Z"
  }
}
```

---

#### `PUT /api/config/plan`

Update global plan configuration.

**Authentication:** JWT Required + Admin Role

**Request Body:**

```json
{
  "levelIncomeRates": {
    "1": 10, "2": 5, "3": 4, "4": 4, "5": 3,
    "6": 3, "7": 3, "8": 2, "9": 2, "10": 2,
    "11": 2, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1
  },
  "withdrawalFeePercent": 10,
  "minWithdrawalAmount": 10
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Plan configuration updated",
  "data": { ... }
}
```

---

#### `GET /api/config/ranks`

Get all rank configurations.

**Authentication:** JWT Required + Admin Role

**Success Response (200):**

```json
{
  "success": true,
  "message": "Ranks retrieved",
  "data": [
    {
      "id": "clxyz123...",
      "name": "EXPLORER",
      "order": 1,
      "requiredBusiness": "5000.00",
      "bonusAmount": "250.00",
      "royaltyPercent": "0.00",
      "createdAt": "2025-11-26T12:00:00.000Z",
      "updatedAt": "2025-11-26T12:00:00.000Z"
    },
    {
      "name": "NAVIGATOR",
      "order": 4,
      "requiredBusiness": "100000.00",
      "bonusAmount": "3000.00",
      "royaltyPercent": "1.00"
    }
  ]
}
```

---

#### `POST /api/config/ranks`

Create or update a rank configuration.

**Authentication:** JWT Required + Admin Role

**Request Body:**

```json
{
  "name": "NAVIGATOR",
  "order": 4,
  "requiredBusiness": 100000,
  "bonusAmount": 3000,
  "royaltyPercent": 1.0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique rank name |
| order | number | Yes | Hierarchy order (1 = lowest) |
| requiredBusiness | number | Yes | Total team business required |
| bonusAmount | number | Yes | One-time bonus on achievement |
| royaltyPercent | number | Yes | % of monthly CTO (0 if not eligible) |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Rank configuration saved",
  "data": { ... }
}
```

---

#### `DELETE /api/config/ranks/:name`

Delete a rank configuration.

**Authentication:** JWT Required + Admin Role

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Rank name to delete |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Rank deleted"
}
```

---

### Reports Module (Admin)

Base path: `/api/admin/reports`

All routes require JWT authentication + Admin role.

---

#### `GET /api/admin/reports/summary`

Get platform summary statistics.

**Authentication:** JWT Required + Admin Role

**Success Response (200):**

```json
{
  "success": true,
  "message": "Platform summary retrieved",
  "data": {
    "users": {
      "total": 1500,
      "verified": 1200,
      "unverified": 300
    },
    "investments": {
      "totalVolume": "5000000.00",
      "totalCount": 2500,
      "activeCount": 1800
    },
    "withdrawals": {
      "totalVolume": "1200000.00",
      "totalCount": 800,
      "pendingCount": 25
    },
    "commissions": {
      "total": "750000.00"
    },
    "royalties": {
      "total": "150000.00"
    },
    "rankDistribution": [
      { "rank": "NONE", "count": 500 },
      { "rank": "EXPLORER", "count": 400 },
      { "rank": "NAVIGATOR", "count": 200 },
      { "rank": "LEGEND", "count": 5 }
    ]
  }
}
```

---

#### `GET /api/admin/reports/investments`

Get investment volume report.

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | daily | Grouping: daily, weekly, monthly |
| days | number | 30 | Number of days to look back |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Investment report retrieved",
  "data": {
    "period": "daily",
    "days": 30,
    "data": [
      { "date": "2025-11-20", "volume": "50000.00" },
      { "date": "2025-11-21", "volume": "75000.00" },
      { "date": "2025-11-22", "volume": "45000.00" }
    ],
    "total": "1500000.00"
  }
}
```

---

#### `GET /api/admin/reports/users`

Get user growth report.

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | number | 30 | Number of days to look back |

**Success Response (200):**

```json
{
  "success": true,
  "message": "User growth report retrieved",
  "data": {
    "days": 30,
    "data": [
      { "date": "2025-11-20", "count": 15 },
      { "date": "2025-11-21", "count": 22 },
      { "date": "2025-11-22", "count": 18 }
    ],
    "totalNewUsers": 450
  }
}
```

---

#### `GET /api/admin/reports/commissions`

Get commission payout report.

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | number | 30 | Number of days to look back |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Commission report retrieved",
  "data": {
    "days": 30,
    "breakdown": {
      "COMMISSION": { "total": "150000.00", "count": 5000 },
      "ROI": { "total": "400000.00", "count": 12000 },
      "ROYALTY": { "total": "50000.00", "count": 150 },
      "RANK_BONUS": { "total": "25000.00", "count": 50 }
    },
    "dailyRoiTrend": [
      { "date": "2025-11-20", "amount": "15000.00" },
      { "date": "2025-11-21", "amount": "14500.00" }
    ]
  }
}
```

---

#### `GET /api/admin/reports/top-performers`

Get top performers leaderboard.

**Authentication:** JWT Required + Admin Role

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 10 | Number of top performers |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Top performers retrieved",
  "data": {
    "topEarners": [
      {
        "userId": "clxyz123...",
        "email": "whale@example.com",
        "name": "John Whale",
        "rank": "LEGEND",
        "totalEarnings": "150000.00"
      }
    ],
    "topReferrers": [
      {
        "userId": "clxyz456...",
        "email": "recruiter@example.com",
        "name": "Jane Recruiter",
        "rank": "GRANDMASTER",
        "referralCount": 156
      }
    ],
    "topInvestors": [
      {
        "userId": "clxyz789...",
        "email": "investor@example.com",
        "name": "Bob Investor",
        "rank": "IMPERATOR",
        "totalInvested": "500000.00"
      }
    ]
  }
}
```

---

## Enums & Types

### UserRole

```typescript
enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR'
}
```

### WalletType

```typescript
enum WalletType {
  DEPOSIT = 'DEPOSIT',     // Active MLM investments
  STAKING = 'STAKING',     // Fixed-term deposits
  REWARD = 'REWARD',       // All earnings
  WITHDRAWAL = 'WITHDRAWAL' // Ready for cashout
}
```

### TransactionType

```typescript
enum TransactionType {
  DEPOSIT = 'DEPOSIT',           // External -> Fiat
  TRANSFER = 'TRANSFER',         // Wallet -> Wallet
  INVESTMENT = 'INVESTMENT',     // Fiat -> Deposit/Staking
  ROI = 'ROI',                   // System -> Reward
  COMMISSION = 'COMMISSION',     // Referral/Level Income
  WITHDRAWAL = 'WITHDRAWAL',     // Withdrawal -> External
  ADMIN_ADJUST = 'ADMIN_ADJUST', // Admin manual credit/debit
  STAKING_RETURN = 'STAKING_RETURN', // Staking maturity
  ROYALTY = 'ROYALTY',           // Monthly royalty
  RANK_BONUS = 'RANK_BONUS'      // One-time rank bonus
}
```

### TransactionStatus

```typescript
enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED'
}
```

### InvestmentType

```typescript
enum InvestmentType {
  PACKAGE = 'PACKAGE',  // MLM active investment
  FIXED = 'FIXED'       // Fixed-term staking
}
```

### InvestmentStatus

```typescript
enum InvestmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}
```

### Default Ranks

| Order | Name | Required Business | Bonus | Royalty % |
|-------|------|-------------------|-------|-----------|
| 1 | EXPLORER | $5,000 | $250 | 0% |
| 2 | PATHFINDER | $15,000 | $750 | 0% |
| 3 | CHALLENGER | $40,000 | $1,500 | 0% |
| 4 | NAVIGATOR | $100,000 | $3,000 | 1% |
| 5 | CHAMPION | $200,000 | $5,000 | 0% |
| 6 | COMMANDER | $350,000 | $7,500 | 0% |
| 7 | STRATEGIST | $500,000 | $9,000 | 0.5% |
| 8 | TRAILBLAZER | $1,000,000 | $15,000 | 0% |
| 9 | GRANDMASTER | $1,500,000 | $20,000 | 0.5% |
| 10 | LEGEND | $2,500,000 | $25,000 | 0% |
| 11 | CROWN PRINCE | $4,000,000 | $30,000 | 0.5% |
| 12 | KING | $5,500,000 | $35,000 | 0% |
| 13 | EMPEROR | $7,000,000 | $40,000 | 0.5% |
| 14 | SUPREME LEADER | $8,500,000 | $45,000 | 0% |
| 15 | IMPERATOR | $10,000,000 | $50,000 | 0.5% |

**Note:** Rank qualification uses the 60:40 rule - strongest leg can contribute max 60% of required business.

---

## Scheduled Jobs

The system runs automated jobs via `node-cron`:

| Job | Schedule | Description |
|-----|----------|-------------|
| ROI Engine | Monthly 1st 00:00 UTC | Calculate and distribute monthly ROI |
| Rank Engine | Daily 01:00 UTC | Check and update user ranks |
| Royalty Engine | Monthly 1st 02:00 UTC | Distribute monthly royalty to qualified users |

Admin can manually trigger these via:
- `POST /api/admin/roi/trigger`
- `POST /api/admin/rank/trigger`
- `POST /api/admin/royalty/trigger`

---

## Blockchain Integration

The backend integrates with deployed smart contracts on Sepolia testnet:

| Contract | Address |
|----------|---------|
| GlobeRiseToken | `0x983094412697e543B4EE295cE295a0D3eeA7aD76` |
| GlobeRisePlatform | `0x50deB505aB03E432E3b767e8D47cc6cc35d80A17` |

**Environment Variables:**

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PLATFORM_ADDRESS=0x50deB505aB03E432E3b767e8D47cc6cc35d80A17
TOKEN_ADDRESS=0x983094412697e543B4EE295cE295a0D3eeA7aD76
```

---

## Rate Limiting

Rate limiting is **disabled for development**. In production, the following limits apply:

| Route | Limit |
|-------|-------|
| `/api/auth/login` | 5 requests per 15 minutes |
| `/api/auth/register` | 3 requests per hour |
| `/api/auth/forgot-password` | 3 requests per hour |
| `/api/2fa/*` | 5 requests per 5 minutes |
| `/api/admin/*` | 100 requests per 15 minutes |
| General API | 100 requests per 15 minutes |

---

## Security Headers

The API uses Helmet.js for security headers:

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: default-src 'self'

---

*Generated: November 26, 2025*

