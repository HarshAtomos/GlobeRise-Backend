# Two-Factor Authentication (2FA) - Frontend Integration Guide

## Overview

2FA uses TOTP (Time-based One-Time Password) compatible with Google Authenticator and Microsoft Authenticator.

---

## User Flow

### 1️⃣ Setup 2FA

**Endpoint:** `POST /api/2fa/setup`  
**Auth:** Required (Bearer token)

**Response:**

```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

**Frontend Actions:**

- Display the QR code for user to scan with their authenticator app
- Show backup codes with download/copy option
- ⚠️ Warn user to save backup codes securely
- Proceed to enable step

---

### 2️⃣ Enable 2FA

**Endpoint:** `POST /api/2fa/enable`  
**Auth:** Required (Bearer token)

**Request:**

```json
{
  "token": "123456" // 6-digit code from authenticator app
}
```

**Response:**

```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

**Frontend Actions:**

- Show success message
- Update user profile to show 2FA is enabled
- Redirect to dashboard/settings

---

### 3️⃣ Login with 2FA Enabled

#### Step A: Initial Login

**Endpoint:** `POST /api/auth/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (2FA Required):**

```json
{
  "success": true,
  "data": {
    "requiresTwoFactor": true,
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Frontend Actions:**

- Detect `requiresTwoFactor: true`
- Save `tempToken` temporarily
- Show 2FA verification screen

#### Step B: Verify 2FA Code

**Endpoint:** `POST /api/2fa/verify-login`  
**Auth:** Required (use the `tempToken` from step A)

**Request:**

```json
{
  "token": "123456", // 6-digit code from authenticator
  "useBackupCode": false // optional, default: false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Frontend Actions:**

- Save the real `token` and `refreshToken`
- Clear `tempToken`
- Redirect to dashboard

---

### 4️⃣ Disable 2FA

**Endpoint:** `POST /api/2fa/disable`  
**Auth:** Required (Bearer token)

**Request:**

```json
{
  "password": "user_password"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

**Frontend Actions:**

- Show confirmation dialog before disabling
- Update user profile to show 2FA is disabled

---

### 5️⃣ Regenerate Backup Codes

**Endpoint:** `POST /api/2fa/backup-codes/regenerate`  
**Auth:** Required (Bearer token)

**Response:**

```json
{
  "success": true,
  "data": {
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

**Frontend Actions:**

- Show new backup codes
- Provide download/copy option
- ⚠️ Warn that old codes are now invalid

---

## Implementation Checklist

### Settings Page

- Add "Enable 2FA" button (if disabled)
- Show 2FA status indicator
- Add "Disable 2FA" button (if enabled)
- Add "Regenerate Backup Codes" button (if enabled)

### 2FA Setup Flow

- QR code display component
- Backup codes display with copy/download
- 6-digit code input field
- Error handling for invalid codes

### Login Flow

- Detect `requiresTwoFactor` in login response
- 2FA verification screen
- "Use backup code instead" toggle
- Resend/retry logic

### Security Best Practices

- Show clear instructions for backup codes

---

## Rate Limiting

- `/api/2fa/verify-login`: 5 attempts per 15 minutes
- `/api/2fa/enable`: 5 attempts per 15 minutes
- `/api/2fa/disable`: 5 attempts per 15 minutes

Show appropriate error messages when rate limit is hit.

---

## Testing Tips

1. **Test with Google Authenticator or Microsoft Authenticator**
2. **Test backup codes** - ensure they work only once
3. **Test rate limiting** - verify user gets locked out after too many attempts
4. **Test disable flow** - ensure 2FA can be turned off with password
5. **Test backup code regeneration** - verify old codes become invalid

---
