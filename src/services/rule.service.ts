import prisma from '../config/database';
import { RuleCategory } from '@prisma/client';

class RuleService {
  /**
   * Get all active rules, optionally filtered by category
   */
  async getActiveRules(category?: RuleCategory) {
    const where: any = { active: true };
    if (category) {
      where.category = category;
    }

    return await prisma.rule.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ]
    });
  }

  /**
   * Get all rules (admin only)
   */
  async getAllRules(category?: RuleCategory) {
    const where: any = {};
    if (category) {
      where.category = category;
    }

    return await prisma.rule.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ]
    });
  }

  /**
   * Get rule by ID
   */
  async getRuleById(id: string) {
    return await prisma.rule.findUnique({
      where: { id }
    });
  }

  /**
   * Create a new rule
   */
  async createRule(data: {
    category: RuleCategory;
    title: string;
    content: string;
    order: number;
    active?: boolean;
  }) {
    return await prisma.rule.create({
      data: {
        category: data.category,
        title: data.title,
        content: data.content,
        order: data.order,
        active: data.active !== undefined ? data.active : true
      }
    });
  }

  /**
   * Update a rule
   */
  async updateRule(id: string, data: {
    category?: RuleCategory;
    title?: string;
    content?: string;
    order?: number;
    active?: boolean;
  }) {
    return await prisma.rule.update({
      where: { id },
      data
    });
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string) {
    return await prisma.rule.delete({
      where: { id }
    });
  }
}

export default new RuleService();

