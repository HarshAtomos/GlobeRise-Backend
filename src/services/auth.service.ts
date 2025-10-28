import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { Request } from 'express';
import prisma from '../config/database';
import { config } from '../config/env';
import emailService from './email.service';
import tokenService from './token.service';
import { AuthResponse, JWTPayload, UserResponse } from '../types';

class AuthService {
  private readonly SALT_ROUNDS = 10;

  // Generate JWT Token
  generateToken(userId: string, email: string): string {
    const payload: JWTPayload = { userId, email };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  // Verify JWT Token
  verifyToken(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Compare password
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate verification token
  generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  // Format user response (exclude sensitive data)
  formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      is_verified: user.is_verified,
      role: user.role,
      two_factor_enabled: user.two_factor_enabled,
      created_at: user.created_at,
    };
  }

  // Get user by ID
  async getUserById(userId: string) {
    return await prisma.user.findUnique({ where: { id: userId } });
  }

  // Register with email/password
  async registerWithEmail(email: string, password: string, req?: Request): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password and generate verification token
    const passwordHash = await this.hashPassword(password);
    const verificationToken = this.generateVerificationToken();

    // Set verification token expiry (24 hours from now)
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        verification_token: verificationToken,
        verification_token_expires: verificationExpiry,
        is_verified: false,
        profile: {
          create: {}, // Create empty profile
        },
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken);

    // Generate JWT and refresh token
    const token = this.generateToken(user.id, user.email);
    const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);

    return {
      user: this.formatUserResponse(user),
      token,
      refreshToken,
    };
  }

  // Login with email/password
  async loginWithEmail(email: string, password: string, req?: Request): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValidPassword = await this.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // If 2FA is enabled, return a temporary token for 2FA verification
    if (user.two_factor_enabled) {
      const tempToken = this.generateToken(user.id, user.email);
      return {
        user: this.formatUserResponse(user),
        token: '', // No token yet
        requiresTwoFactor: true,
        tempToken, // Temporary token for 2FA verification
      };
    }

    // Generate JWT and refresh token
    const token = this.generateToken(user.id, user.email);
    const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);

    return {
      user: this.formatUserResponse(user),
      token,
      refreshToken,
    };
  }

  // Verify email
  async verifyEmail(token: string, req?: Request): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { verification_token: token },
    });

    if (!user || !user.verification_token_expires) {
      throw new Error('Invalid or expired verification token');
    }

    // Check if token is expired (24 hours)
    if (user.verification_token_expires < new Date()) {
      throw new Error('Verification token has expired. Please request a new verification email.');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verification_token: null,
        verification_token_expires: null,
      },
    });

    // Generate JWT and refresh token for auto-login
    const jwtToken = this.generateToken(updatedUser.id, updatedUser.email);
    const refreshToken = await tokenService.generateRefreshToken(updatedUser.id, updatedUser.email, req);

    return {
      user: this.formatUserResponse(updatedUser),
      token: jwtToken,
      refreshToken,
    };
  }

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<void> {
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if user exists or not for security
      return;
    }

    // Check if already verified
    if (user.is_verified) {
      throw new Error('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = this.generateVerificationToken();

    // Set new expiry (24 hours from now)
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token: verificationToken,
        verification_token_expires: verificationExpiry,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken);
  }

  // Find or create OAuth user (Google only)
  async findOrCreateOAuthUser(
    email: string,
    oauthId: string,
    provider: 'google',
    req?: Request
  ): Promise<AuthResponse> {
    // Try to find user by Google OAuth ID
    let user = await prisma.user.findUnique({
      where: { google_id: oauthId },
    });

    if (user) {
      // User found with OAuth ID
      const token = this.generateToken(user.id, user.email);
      const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);
      return {
        user: this.formatUserResponse(user),
        token,
        refreshToken,
      };
    }

    // Try to find user by email (for account linking)
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          google_id: oauthId,
          is_verified: true, // Google emails are pre-verified
        },
      });

      const token = this.generateToken(user.id, user.email);
      const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);
      return {
        user: this.formatUserResponse(user),
        token,
        refreshToken,
      };
    }

    // Create new user with Google account and profile
    user = await prisma.user.create({
      data: {
        email,
        google_id: oauthId,
        is_verified: true, // Google emails are pre-verified
        profile: {
          create: {}, // Create empty profile
        },
      },
    });

    const token = this.generateToken(user.id, user.email);
    const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);
    return {
      user: this.formatUserResponse(user),
      token,
      refreshToken,
    };
  }
}

export default new AuthService();