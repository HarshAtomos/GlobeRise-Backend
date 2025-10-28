import { Request, Response, NextFunction } from 'express';
import profileService from '../services/profile.service';
import { ResponseHandler } from '../utils/response';

class ProfileController {
    // Get current user's profile
    async getMyProfile(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const profile = await profileService.getProfile(req.user.id);

            if (!profile) {
                return ResponseHandler.notFound(res, 'Profile not found');
            }

            return ResponseHandler.success(res, 'Profile retrieved successfully', { profile });
        } catch (error) {
            next(error);
        }
    }

    // Update current user's profile
    async updateMyProfile(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const { firstName, lastName, phone, avatarUrl, address, city, state, zipCode, country } = req.body;

            const profile = await profileService.updateProfile(req.user.id, {
                firstName,
                lastName,
                phone,
                avatarUrl,
                address,
                city,
                state,
                zipCode,
                country,
            });

            return ResponseHandler.success(res, 'Profile updated successfully', { profile });
        } catch (error) {
            next(error);
        }
    }

    // Get another user's public profile
    async getUserProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            const profile = await profileService.getPublicProfile(userId);

            if (!profile) {
                return ResponseHandler.notFound(res, 'Profile not found');
            }

            return ResponseHandler.success(res, 'Profile retrieved successfully', { profile });
        } catch (error) {
            next(error);
        }
    }
}

export default new ProfileController();


