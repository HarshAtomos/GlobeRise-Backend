import { Request, Response, NextFunction } from 'express';
import ruleService from '../services/rule.service';
import { ResponseHandler } from '../utils/response';
import { RuleCategory } from '@prisma/client';

class RuleController {
  /**
   * Get active rules (public/user endpoint)
   */
  async getActiveRules(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as RuleCategory | undefined;
      const rules = await ruleService.getActiveRules(category);
      return ResponseHandler.success(res, 'Rules retrieved', rules);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all rules (admin only)
   */
  async getAllRules(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as RuleCategory | undefined;
      const rules = await ruleService.getAllRules(category);
      return ResponseHandler.success(res, 'Rules retrieved', rules);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get rule by ID
   */
  async getRuleById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const rule = await ruleService.getRuleById(id);
      if (!rule) {
        return ResponseHandler.notFound(res, 'Rule not found');
      }
      return ResponseHandler.success(res, 'Rule retrieved', rule);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new rule (admin only)
   */
  async createRule(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, title, content, order, active } = req.body;

      if (!category || !title || !content || order === undefined) {
        return ResponseHandler.badRequest(res, 'Missing required fields: category, title, content, order');
      }

      const rule = await ruleService.createRule({
        category,
        title,
        content,
        order,
        active
      });

      return ResponseHandler.success(res, 'Rule created', rule, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update a rule (admin only)
   */
  async updateRule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { category, title, content, order, active } = req.body;

      const rule = await ruleService.updateRule(id, {
        category,
        title,
        content,
        order,
        active
      });

      return ResponseHandler.success(res, 'Rule updated', rule);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a rule (admin only)
   */
  async deleteRule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ruleService.deleteRule(id);
      return ResponseHandler.success(res, 'Rule deleted');
    } catch (err) {
      next(err);
    }
  }
}

export default new RuleController();

