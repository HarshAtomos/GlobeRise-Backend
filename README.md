# 🌐 Globerise Backend - Authentication System

A secure, production-ready authentication backend built with **Node.js**, **TypeScript**, **Express**, **Prisma**, and **PostgreSQL**.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [File Descriptions](#-file-descriptions)
- [Recent Changes](#-recent-changes)
- [Security Features](#-security-features)
- [Future Enhancements](#-future-enhancements)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### Current Implementation

✅ **Email/Password Authentication**

- User registration with email verification
- Secure password hashing (bcrypt with 10 salt rounds)
- Login with JWT token generation
- Email verification flow

✅ **Google OAuth 2.0 Integration**

- Google Sign-In
- Automatic account linking (email-based)
- Pre-verified accounts via OAuth

✅ **JWT Authentication**

- Secure token generation
- Token-based protected routes
- Configurable token expiration

✅ **Security**

- Helmet.js security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Input validation with express-validator
- Password strength requirements

✅ **Email Service**

- Verification email sending
- SMTP integration (Gmail supported)
- HTML email templates

---

## 🛠 Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (Neon DB)
- **ORM:** Prisma
- **Authentication:** Passport.js (JWT, Local, Google OAuth)
- **Password Hashing:** bcrypt
- **Email:** Nodemailer
- **Validation:** express-validator
- **Security:** Helmet, CORS, express-rate-limit

---

## 📁 Project Structure

```
globerise-backend/
├── src/
│   ├── config/
│   │   ├── database.ts         # Prisma client configuration
│   │   ├── env.ts              # Environment variables & validation
│   │   └── passport.ts         # Passport.js strategies (JWT, Local, Google)
│   │
│   ├── controllers/
│   │   └── auth.controller.ts  # Authentication endpoint handlers
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts  # JWT authentication & verification middleware
│   │   └── error.middleware.ts # Global error handling
│   │
│   ├── routes/
│   │   └── auth.routes.ts      # Authentication route definitions
│   │
│   ├── services/
│   │   ├── auth.service.ts     # Authentication business logic
│   │   └── email.service.ts    # Email sending functionality
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   │
│   ├── utils/
│   │   └── response.ts         # Standardized API response helpers
│   │
│   ├── validators/
│   │   └── auth.validator.ts   # Request validation rules
│   │
│   ├── app.ts                  # Express app configuration
│   └── server.ts               # Server startup & graceful shutdown
│
├── prisma/
│   └── schema.prisma           # Database schema definition
│
├── .env                        # Environment variables (not in git)
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=6969
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (Neon DB PostgreSQL)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM=noreply@globerise.com

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:6969/api/auth/google/callback
```

### 3. Gmail SMTP Setup

1. Go to [Google Account Settings](https://myaccount.google.com/) → **Security**
2. Enable **2-Factor Authentication**
3. Generate **App Password**: Security → 2-Step Verification → App passwords
4. Use the 16-character password as `SMTP_PASS` in `.env`

### 4. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 5. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Create **OAuth 2.0 credentials** (Web application)
5. Add authorized redirect URI: `http://localhost:6969/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### 6. Run the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

Server will start at: **http://localhost:6969**

---

## 🔐 Environment Variables

### Required Variables

| Variable       | Description                  | Example                                          |
| -------------- | ---------------------------- | ------------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET`   | Secret key for JWT signing   | Generate: `openssl rand -base64 32`              |
| `SMTP_HOST`    | SMTP server hostname         | `smtp.gmail.com`                                 |
| `SMTP_USER`    | SMTP username (email)        | `your-email@gmail.com`                           |
| `SMTP_PASS`    | SMTP password (app password) | `abcd efgh ijkl mnop`                            |

### Optional Variables

| Variable         | Description                       | Default                 |
| ---------------- | --------------------------------- | ----------------------- |
| `PORT`           | Server port                       | `6969`                  |
| `NODE_ENV`       | Environment mode                  | `development`           |
| `FRONTEND_URL`   | Frontend URL for CORS & redirects | `http://localhost:5173` |
| `JWT_EXPIRES_IN` | JWT token expiration              | `7d`                    |
| `SMTP_PORT`      | SMTP server port                  | `587`                   |
| `EMAIL_FROM`     | Email sender address              | (required)              |

---

## 📡 API Documentation

**Base URL:** `http://localhost:6969/api`

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-10-23T10:30:00.000Z"
}
```

---

### Authentication Endpoints

#### 1. Register with Email/Password

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Password Requirements:**

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

**Success Response (201):**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "user@example.com",
      "is_verified": false,
      "created_at": "2025-10-23T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (422):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter"
    }
  ]
}
```

---

#### 2. Login with Email/Password

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "user@example.com",
      "is_verified": true,
      "created_at": "2025-10-23T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

#### 3. Verify Email

```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "verification_token_from_email"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "user@example.com",
      "is_verified": true,
      "created_at": "2025-10-23T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

#### 4. Google OAuth Login

**Step 1: Initiate OAuth**

```http
GET /api/auth/google
```

Redirects user to Google consent screen.

**Step 2: Callback (automatic)**

```http
GET /api/auth/google/callback
```

Redirects to: `{FRONTEND_URL}/auth/callback?token={JWT_TOKEN}`

---

#### 5. Get Current User (Protected)

```http
GET /api/auth/me
Authorization: Bearer {JWT_TOKEN}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "user@example.com",
      "is_verified": true,
      "created_at": "2025-10-23T10:30:00.000Z"
    }
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

#### 6. Refresh Token (Future Implementation)

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

**Current Response (501):**

```json
{
  "success": false,
  "message": "Refresh token endpoint not implemented yet"
}
```

---

### Using JWT Tokens

Include the JWT token in the Authorization header for protected routes:

```javascript
// Example using fetch
fetch("http://localhost:6969/api/auth/me", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

---

## 📄 File Descriptions

### Configuration Files

#### `src/config/database.ts`

- Initializes Prisma Client
- Configures query logging based on environment
- Exports singleton Prisma instance

#### `src/config/env.ts`

- Loads environment variables from `.env`
- Exports typed configuration object
- Validates required environment variables on startup

#### `src/config/passport.ts`

- Configures Passport.js authentication strategies:
  - **JWT Strategy:** Validates JWT tokens from Authorization header
  - **Local Strategy:** Email/password authentication
  - **Google OAuth Strategy:** Google Sign-In flow

---

### Controllers

#### `src/controllers/auth.controller.ts`

Handles HTTP requests for authentication endpoints:

- `register()` - User registration with email/password
- `login()` - User login with credentials
- `verifyEmail()` - Email verification
- `googleCallback()` - Google OAuth callback handler
- `getCurrentUser()` - Get authenticated user details
- `refreshToken()` - Placeholder for refresh token logic

---

### Middleware

#### `src/middleware/auth.middleware.ts`

- `authenticateJWT()` - Validates JWT tokens on protected routes
- `requireVerified()` - Ensures user has verified email
- Extends Express `User` type with custom properties

#### `src/middleware/error.middleware.ts`

- `errorHandler()` - Global error handler for all routes
  - Handles Prisma errors (P2002, P2025)
  - Handles JWT errors (invalid/expired tokens)
  - Returns standardized error responses
- `notFoundHandler()` - Handles 404 errors for undefined routes

---

### Routes

#### `src/routes/auth.routes.ts`

Defines all authentication routes:

- `/register` - User registration
- `/login` - User login
- `/verify-email` - Email verification
- `/google` - Initiate Google OAuth
- `/google/callback` - Google OAuth callback
- `/me` - Get current user (protected)
- `/refresh` - Refresh token (placeholder)

---

### Services

#### `src/services/auth.service.ts`

Core authentication business logic:

- `generateToken()` - Creates JWT tokens
- `verifyToken()` - Validates JWT tokens
- `hashPassword()` - Hashes passwords with bcrypt
- `comparePassword()` - Compares password with hash
- `registerWithEmail()` - Handles email/password registration
- `loginWithEmail()` - Handles email/password login
- `verifyEmail()` - Verifies user email
- `findOrCreateOAuthUser()` - Google OAuth user management
- `formatUserResponse()` - Excludes sensitive data from responses

#### `src/services/email.service.ts`

Email functionality:

- `sendVerificationEmail()` - Sends email verification link
- `sendPasswordResetEmail()` - Sends password reset link (future)
- Configures Nodemailer SMTP transport
- Uses HTML email templates

---

### Types

#### `src/types/index.ts`

TypeScript type definitions:

- `ApiResponse<T>` - Standardized API response structure
- `AuthResponse` - Authentication response (user + token)
- `UserResponse` - User data without sensitive fields
- `JWTPayload` - JWT token payload structure
- `ValidationError` - Validation error format

---

### Utilities

#### `src/utils/response.ts`

Standardized response helpers:

- `ResponseHandler.success()` - Success responses (200, 201)
- `ResponseHandler.error()` - Error responses
- `ResponseHandler.validationError()` - Validation errors (422)
- `ResponseHandler.unauthorized()` - 401 responses
- `ResponseHandler.forbidden()` - 403 responses
- `ResponseHandler.notFound()` - 404 responses
- `ResponseHandler.serverError()` - 500 responses

---

### Validators

#### `src/validators/auth.validator.ts`

Request validation rules using express-validator:

- `registerValidator` - Registration input validation
  - Email format & normalization
  - Password strength requirements
- `loginValidator` - Login input validation
- `verifyEmailValidator` - Email verification token validation
- `handleValidationErrors()` - Middleware to process validation results

---

### Application Files

#### `src/app.ts`

Express application configuration:

- Security middleware (Helmet, CORS)
- Rate limiting
- Body parsing
- Passport initialization
- Route mounting
- Error handling

#### `src/server.ts`

Server startup and lifecycle:

- Database connection testing
- Server startup
- Graceful shutdown handlers (SIGINT, SIGTERM)
- Process exit handling

---

### Database

#### `prisma/schema.prisma`

Database schema definition:

- **User Model:**
  - `id` - Unique identifier (cuid)
  - `email` - Unique email address
  - `password_hash` - Hashed password (optional for OAuth users)
  - `google_id` - Google OAuth ID (optional)
  - `is_verified` - Email verification status
  - `verification_token` - Email verification token
  - `created_at` - Account creation timestamp
  - `updated_at` - Last update timestamp
- Indexes on email, google_id, verification_token for performance

---

## 🔄 Recent Changes

### TypeScript Compilation Fixes

1. **Passport Strategy Type Errors (passport.ts)**

   - **Issue:** `done` callbacks expected `User` object, but received `AuthResponse`
   - **Fix:** Changed to pass `result.user` instead of `result`
   - **Lines:** 45, 76

2. **JWT Sign Type Error (auth.service.ts)**

   - **Issue:** `expiresIn` type mismatch in `jwt.sign()`
   - **Fix:** Added type casting: `config.jwt.expiresIn as jwt.SignOptions['expiresIn']`
   - **Line:** 16

3. **Prisma Dynamic Field Error (auth.service.ts)**
   - **Issue:** TypeScript couldn't verify dynamic field names `[oauthField]`
   - **Fix:** Replaced dynamic access with explicit ternary conditionals
   - **Lines:** 143-145, 164-166, 178-180

### Facebook OAuth Removal

All Facebook authentication logic has been removed:

1. **Removed from `src/config/passport.ts`:**

   - Removed `FacebookStrategy` import
   - Removed Facebook OAuth strategy configuration

2. **Removed from `src/config/env.ts`:**

   - Removed `facebook` object from `oauth` config
   - Removed Facebook environment variables

3. **Removed from `src/controllers/auth.controller.ts`:**

   - Removed `facebookCallback()` method

4. **Removed from `src/routes/auth.routes.ts`:**

   - Removed `/facebook` initiation route
   - Removed `/facebook/callback` route

5. **Removed from `prisma/schema.prisma`:**

   - Removed `facebook_id` field from User model
   - Removed `facebook_id` index

6. **Removed from `package.json`:**

   - Removed `passport-facebook` dependency
   - Removed `@types/passport-facebook` dev dependency

7. **Updated `src/services/auth.service.ts`:**
   - Changed `findOrCreateOAuthUser()` to only accept `'google'` provider
   - Simplified OAuth logic to Google-only

**Note:** After these changes, run:

```bash
npm install                    # Remove unused Facebook packages
npm run prisma:generate        # Regenerate Prisma client
npm run prisma:migrate         # Create migration for schema changes
```

---

## 🛡️ Security Features

✅ **Password Security**

- bcrypt hashing with 10 salt rounds
- Password strength requirements enforced
- Passwords never stored in plain text

✅ **JWT Security**

- Configurable secret key
- Token expiration (default 7 days)
- Bearer token authentication

✅ **HTTP Security**

- Helmet.js security headers
- CORS configuration
- XSS protection
- Content Security Policy

✅ **Rate Limiting**

- 100 requests per 15 minutes per IP
- Applied to all `/api/*` routes
- Prevents brute force attacks

✅ **Input Validation**

- express-validator for request validation
- Email format validation
- Password complexity requirements
- SQL injection prevention via Prisma

✅ **Email Verification**

- Cryptographically secure verification tokens
- Email ownership validation
- Account activation flow

---

## 🚧 Future Enhancements

### High Priority

- [ ] **Refresh Token Implementation**

  - Implement refresh token rotation
  - Add refresh token storage in database
  - Create `/api/auth/refresh` endpoint

- [ ] **Password Reset Flow**

  - Generate password reset tokens
  - Send password reset emails
  - Create password reset endpoints

- [ ] **Two-Factor Authentication (2FA)**
  - TOTP implementation
  - QR code generation
  - Backup codes

### Medium Priority

- [ ] **User Profile Management**

  - Update profile information
  - Change password
  - Delete account

- [ ] **Role-Based Access Control (RBAC)**

  - User roles (admin, user, etc.)
  - Permission system
  - Protected routes by role

- [ ] **Session Management**

  - Active sessions tracking
  - Logout from all devices
  - Session invalidation

- [ ] **Enhanced Security**
  - Account lockout after failed attempts
  - IP-based rate limiting
  - Suspicious activity detection

### Low Priority

- [ ] **Social Features**

  - GitHub OAuth integration
  - Microsoft OAuth integration
  - Apple Sign-In

- [ ] **Analytics & Monitoring**

  - Login attempt tracking
  - User activity logs
  - Error tracking integration

- [ ] **Email Templates**
  - Welcome emails
  - Password changed notifications
  - Account activity alerts

---

## 🐛 Troubleshooting

### Email Not Sending

**Problem:** Verification emails not being sent

**Solutions:**

1. Verify Gmail App Password is correct (not regular password)
2. Ensure 2FA is enabled on Google account
3. Check SMTP settings in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # 16-character app password
   ```
4. Check server logs for detailed error messages

---

### Database Connection Error

**Problem:** Cannot connect to PostgreSQL database

**Solutions:**

1. Verify DATABASE_URL format:
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```
2. Ensure Neon DB instance is running
3. Check if `?sslmode=require` is included (required for Neon)
4. Run `npm run prisma:generate` after changing schema
5. Test connection with: `npx prisma db push`

---

### OAuth Not Working

**Problem:** Google OAuth fails or redirects incorrectly

**Solutions:**

1. Verify redirect URI in Google Cloud Console matches exactly:
   ```
   http://localhost:6969/api/auth/google/callback
   ```
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
3. Ensure OAuth consent screen is configured
4. Verify Google+ API is enabled
5. Check that OAuth app is in production mode (not test mode)

---

### TypeScript Compilation Errors

**Problem:** `npm run dev` fails with TypeScript errors

**Solutions:**

1. Run `npm install` to ensure all dependencies are installed
2. Check `tsconfig.json` is properly configured
3. Run `npm run prisma:generate` to regenerate Prisma types
4. Clear `dist/` folder and rebuild: `rm -rf dist && npm run build`
5. Check for type mismatches in recent code changes

---

### Port Already in Use

**Problem:** Server fails to start - port 6969 in use

**Solutions:**

1. Kill existing process:

   ```bash
   # Windows
   netstat -ano | findstr :6969
   taskkill /PID <PID> /F

   # Linux/Mac
   lsof -i :6969
   kill -9 <PID>
   ```

2. Change port in `.env`:
   ```env
   PORT=7000
   ```

---

### JWT Token Invalid/Expired

**Problem:** Protected routes return 401 Unauthorized

**Solutions:**

1. Ensure token is included in Authorization header:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
2. Check token hasn't expired (default 7 days)
3. Verify `JWT_SECRET` matches between token creation and validation
4. Login again to get a fresh token

---

## 📞 Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Descriptive success message",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

---

## 🧪 Testing

### Manual Testing with Postman/Thunder Client

1. **Register a new user:**

   ```
   POST http://localhost:6969/api/auth/register
   Body: { "email": "test@example.com", "password": "Test1234" }
   ```

2. **Check verification email:**

   - Look for verification link in email
   - Extract token from URL

3. **Verify email:**

   ```
   POST http://localhost:6969/api/auth/verify-email
   Body: { "token": "verification_token_here" }
   ```

4. **Login:**

   ```
   POST http://localhost:6969/api/auth/login
   Body: { "email": "test@example.com", "password": "Test1234" }
   ```

5. **Access protected route:**
   ```
   GET http://localhost:6969/api/auth/me
   Headers: { "Authorization": "Bearer <token_from_login>" }
   ```

---

## 📝 Development Notes

- **Node Version:** Requires Node.js v20 or higher
- **Database:** PostgreSQL (tested with Neon DB)
- **TypeScript:** Strict mode enabled
- **Code Style:** ESModuleInterop enabled for better import compatibility
- **Source Maps:** Enabled for debugging

---

## 🤝 Contributing

This is a personal project, but suggestions are welcome! Please ensure:

1. All TypeScript code compiles without errors
2. Follow existing code style and structure
3. Test changes thoroughly before submitting

---

## 📄 License

This project is private and not licensed for public use.

---

## 👤 Author

**Harsh**

- Backend developed with guidance from Claude AI
- Built for Globerise project

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Port:** 6969
