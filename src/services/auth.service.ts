import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { config } from '../config/env';
import emailService from './email.service';
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
      created_at: user.created_at,
    };
  }

  // Register with email/password
  async registerWithEmail(email: string, password: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password and generate verification token
    const passwordHash = await this.hashPassword(password);
    const verificationToken = this.generateVerificationToken();

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        verification_token: verificationToken,
        is_verified: false,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken);

    // Generate JWT
    const token = this.generateToken(user.id, user.email);

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  // Login with email/password
  async loginWithEmail(email: string, password: string): Promise<AuthResponse> {
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

    // Generate JWT
    const token = this.generateToken(user.id, user.email);

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  // Verify email
  async verifyEmail(token: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { verification_token: token },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verification_token: null,
      },
    });

    // Generate JWT for auto-login
    const jwtToken = this.generateToken(updatedUser.id, updatedUser.email);

    return {
      user: this.formatUserResponse(updatedUser),
      token: jwtToken,
    };
  }

  // Find or create OAuth user (Google only)
  async findOrCreateOAuthUser(
    email: string,
    oauthId: string,
    provider: 'google'
  ): Promise<AuthResponse> {
    // Try to find user by Google OAuth ID
    let user = await prisma.user.findUnique({
      where: { google_id: oauthId },
    });

    if (user) {
      // User found with OAuth ID
      const token = this.generateToken(user.id, user.email);
      return {
        user: this.formatUserResponse(user),
        token,
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
      return {
        user: this.formatUserResponse(user),
        token,
      };
    }

    // Create new user with Google account
    user = await prisma.user.create({
      data: {
        email,
        google_id: oauthId,
        is_verified: true, // Google emails are pre-verified
      },
    });

    const token = this.generateToken(user.id, user.email);
    return {
      user: this.formatUserResponse(user),
      token,
    };
  }
}

export default new AuthService();