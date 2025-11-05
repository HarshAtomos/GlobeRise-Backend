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
}

export default new ReferralController();


