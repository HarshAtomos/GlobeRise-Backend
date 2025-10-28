export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    errors?: ValidationError[];
}

export interface ValidationError {
    field: string;
    message: string;
}

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
    MODERATOR = 'MODERATOR',
}

export interface AuthResponse {
    user: UserResponse;
    token: string;
    refreshToken?: string;
    requiresTwoFactor?: boolean;
    tempToken?: string; // Temporary token for 2FA verification
}

export interface UserResponse {
    id: string;
    email: string;
    is_verified: boolean;
    role: UserRole;
    two_factor_enabled: boolean;
    created_at: Date;
}

export interface JWTPayload {
    userId: string;
    email: string;
}

export interface RefreshTokenPayload {
    userId: string;
    tokenId: string;
    email: string;
}

export interface ProfileResponse {
    id: string;
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    updatedAt: Date;
}

export interface TwoFactorSetupResponse {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}

export interface SessionResponse {
    id: string;
    ipAddress?: string;
    userAgent?: string;
    lastActivityAt: Date;
    createdAt: Date;
    isCurrent: boolean;
}