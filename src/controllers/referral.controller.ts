import { Request, Response, NextFunction } from 'express';
import referralService from '../services/referral.service';
import { ResponseHandler } from '../utils/response';

class ReferralController {
  async getTree(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const data = await referralService.getDirectTree(req.user.id);
      return ResponseHandler.success(res, 'Referral tree fetched', data);
    } catch (err) {
      next(err);
    }
  }

  // Get user's rank progress
  async getRankProgress(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const data = await referralService.getRankProgress(req.user.id);
      return ResponseHandler.success(res, 'Rank progress retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  // Get public leaderboard (top performers)
  async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const type = (req.query.type as string) || 'earnings'; // earnings, referrals, investments

      const data = await referralService.getLeaderboard(limit, type);
      return ResponseHandler.success(res, 'Leaderboard retrieved', data);
    } catch (err) {
      next(err);
    }
  }
}

export default new ReferralController();


