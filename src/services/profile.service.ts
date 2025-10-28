import prisma from '../config/database';
import { ProfileResponse } from '../types';

class ProfileService {
    // Get user profile
    async getProfile(userId: string): Promise<ProfileResponse | null> {
        const profile = await prisma.userProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return null;
        }

        return this.formatProfileResponse(profile);
    }

    // Update user profile
    async updateProfile(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            avatarUrl?: string;
            address?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
        }
    ): Promise<ProfileResponse> {
        // Check if profile exists, if not create it
        let profile = await prisma.userProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            profile = await prisma.userProfile.create({
                data: {
                    userId,
                    ...data,
                },
            });
        } else {
            profile = await prisma.userProfile.update({
                where: { userId },
                data,
            });
        }

        return this.formatProfileResponse(profile);
    }

    // Get public profile by user ID
    async getPublicProfile(userId: string): Promise<Partial<ProfileResponse> | null> {
        const profile = await prisma.userProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        email: true,
                        created_at: true,
                    },
                },
            },
        });

        if (!profile) {
            return null;
        }

        // Return only public information
        return {
            id: profile.id,
            userId: profile.userId,
            firstName: profile.firstName || undefined,
            lastName: profile.lastName || undefined,
            avatarUrl: profile.avatarUrl || undefined,
            city: profile.city || undefined,
            state: profile.state || undefined,
            country: profile.country || undefined,
        };
    }

    // Format profile response
    private formatProfileResponse(profile: any): ProfileResponse {
        return {
            id: profile.id,
            userId: profile.userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone,
            avatarUrl: profile.avatarUrl,
            address: profile.address,
            city: profile.city,
            state: profile.state,
            zipCode: profile.zipCode,
            country: profile.country,
            updatedAt: profile.updatedAt,
        };
    }
}

export default new ProfileService();


