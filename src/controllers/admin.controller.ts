import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ResponseHandler } from '../utils/response';
import { UserRole } from '../types';
import roiService from '../services/roi.service';
import rankService from '../services/rank.service';
import royaltyService from '../services/royalty.service';

class AdminController {
    // Get all users (admin only)
    async getAllUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { page = 1, limit = 20, role, verified } = req.query;

            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);

            // Build filter
            const where: any = {};
            if (role) {
                where.role = role;
            }
            if (verified !== undefined) {
                where.is_verified = verified === 'true';
            }

            // Get users with pagination
            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take,
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        is_verified: true,
                        two_factor_enabled: true,
                        created_at: true,
                        updated_at: true,
                        rank: true,
                    },
                    orderBy: { created_at: 'desc' },
                }),
                prisma.user.count({ where }),
            ]);

            return ResponseHandler.success(res, 'Users retrieved successfully', {
                users,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            });
        } catch (error) {
            next(error);
        }
    }

    // Get user by ID (admin only)
    async getUserById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    is_verified: true,
                    two_factor_enabled: true,
                    google_id: true,
                    created_at: true,
                    updated_at: true,
                    profile: true,
                    rank: true,
                    rankHistory: true,
                },
            });

            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }

            return ResponseHandler.success(res, 'User retrieved successfully', { user });
        } catch (error) {
            next(error);
        }
    }

    // Assign role to user (admin only)
    async assignRole(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { role } = req.body;

            // Validate role
            if (!Object.values(UserRole).includes(role as UserRole)) {
                return ResponseHandler.badRequest(
                    res,
                    `Invalid role. Valid roles are: ${Object.values(UserRole).join(', ')}`
                );
            }

            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }

            // Prevent self-demotion
            if (req.user?.id === userId && role !== UserRole.ADMIN) {
                return ResponseHandler.badRequest(
                    res,
                    'You cannot remove your own admin privileges'
                );
            }

            // Update user role
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: { role },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    is_verified: true,
                    created_at: true,
                },
            });

            return ResponseHandler.success(res, 'User role updated successfully', {
                user: updatedUser,
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete user (admin only)
    async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }

            // Prevent self-deletion
            if (req.user?.id === userId) {
                return ResponseHandler.badRequest(res, 'You cannot delete your own account');
            }

            // Delete user (cascade will handle related records)
            await prisma.user.delete({
                where: { id: userId },
            });

            return ResponseHandler.success(res, 'User deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    // Get system statistics (admin only)
    async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const [
                totalUsers,
                verifiedUsers,
                usersWithTwoFactor,
                usersByRole,
                recentUsers,
            ] = await Promise.all([
                prisma.user.count(),
                prisma.user.count({ where: { is_verified: true } }),
                prisma.user.count({ where: { two_factor_enabled: true } }),
                prisma.user.groupBy({
                    by: ['role'],
                    _count: true,
                }),
                prisma.user.count({
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                        },
                    },
                }),
            ]);

            const roleStats = usersByRole.reduce((acc, curr) => {
                acc[curr.role] = curr._count;
                return acc;
            }, {} as Record<string, number>);

            return ResponseHandler.success(res, 'Statistics retrieved successfully', {
                stats: {
                    totalUsers,
                    verifiedUsers,
                    unverifiedUsers: totalUsers - verifiedUsers,
                    usersWithTwoFactor,
                    usersByRole: roleStats,
                    recentUsers, // Users registered in last 30 days
                },
            });
        } catch (error) {
            next(error);
        }
    }

    // Manually trigger Daily ROI calculation (Admin only)
    async triggerDailyRoi(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('Admin triggered Daily ROI Engine...');
            const result = await roiService.processDailyRoi();

            return ResponseHandler.success(res, 'Daily ROI processed successfully', {
                processedCount: result.processed,
                totalPayout: result.totalAmount
            });
        } catch (error) {
            next(error);
        }
    }

    // Manually trigger Daily Rank Check (Admin only)
    async triggerRankCheck(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('Admin triggered Daily Rank Engine...');
            await rankService.runDailyRankCheck();

            return ResponseHandler.success(res, 'Rank Engine executed successfully');
        } catch (error) {
            next(error);
        }
    }

    // Manually trigger Monthly Royalty Distribution (Admin only)
    async triggerRoyalty(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('Admin triggered Monthly Royalty Engine...');
            await royaltyService.distributeRoyalty();

            return ResponseHandler.success(res, 'Royalty Engine executed successfully');
        } catch (error) {
            next(error);
        }
    }
}

export default new AdminController();
