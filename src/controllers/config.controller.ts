import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ResponseHandler } from '../utils/response';

class ConfigController {
  // Get Global Plan Config
  async getPlanConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await prisma.planConfig.findUnique({
        where: { key: 'GLOBAL_SETTINGS' }
      });
      return ResponseHandler.success(res, 'Plan configuration retrieved', config);
    } catch (err) {
      next(err);
    }
  }

  // Update Plan Config
  async updatePlanConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { levelIncomeRates, withdrawalFeePercent, minWithdrawalAmount } = req.body;
      
      const config = await prisma.planConfig.upsert({
        where: { key: 'GLOBAL_SETTINGS' },
        update: {
          levelIncomeRates,
          withdrawalFeePercent,
          minWithdrawalAmount
        },
        create: {
          key: 'GLOBAL_SETTINGS',
          levelIncomeRates,
          withdrawalFeePercent,
          minWithdrawalAmount
        }
      });
      
      return ResponseHandler.success(res, 'Plan configuration updated', config);
    } catch (err) {
      next(err);
    }
  }

  // Get All Ranks
  async getRanks(req: Request, res: Response, next: NextFunction) {
    try {
      const ranks = await prisma.rankConfig.findMany({
        orderBy: { order: 'asc' }
      });
      return ResponseHandler.success(res, 'Ranks retrieved', ranks);
    } catch (err) {
      next(err);
    }
  }

  // Create/Update Rank
  async upsertRank(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, order, requiredBusiness, bonusAmount, royaltyPercent } = req.body;

      const rank = await prisma.rankConfig.upsert({
        where: { name },
        update: {
          order,
          requiredBusiness,
          bonusAmount,
          royaltyPercent
        },
        create: {
          name,
          order,
          requiredBusiness,
          bonusAmount,
          royaltyPercent
        }
      });

      return ResponseHandler.success(res, 'Rank configuration saved', rank);
    } catch (err) {
      next(err);
    }
  }

  // Delete Rank
  async deleteRank(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      await prisma.rankConfig.delete({ where: { name } });
      return ResponseHandler.success(res, 'Rank deleted');
    } catch (err) {
      next(err);
    }
  }
}

export default new ConfigController();

