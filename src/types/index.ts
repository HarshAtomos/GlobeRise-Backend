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

export interface AuthResponse {
    user: UserResponse;
    token: string;
}

export interface UserResponse {
    id: string;
    email: string;
    is_verified: boolean;
    created_at: Date;
}

export interface JWTPayload {
    userId: string;
    email: string;
}