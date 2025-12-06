import { Request, Response, NextFunction } from 'express';
import supportService from '../services/support.service';
import { ResponseHandler } from '../utils/response';
import { TicketCategory, TicketStatus, TicketPriority } from '@prisma/client';

class SupportController {
  /**
   * Create a new support ticket
   */
  async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { category, subject, message, priority } = req.body;

      if (!category || !subject || !message) {
        return ResponseHandler.badRequest(res, 'Category, subject, and message are required');
      }

      const ticket = await supportService.createTicket(req.user.id, {
        category,
        subject,
        message,
        priority
      });

      return ResponseHandler.success(res, 'Ticket created successfully', { ticket }, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user's tickets
   */
  async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const status = req.query.status as TicketStatus | undefined;
      const tickets = await supportService.getUserTickets(req.user.id, status);

      return ResponseHandler.success(res, 'Tickets retrieved', { tickets });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicket(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { id } = req.params;
      const ticket = await supportService.getTicketById(id, req.user.id);

      if (!ticket) {
        return ResponseHandler.notFound(res, 'Ticket not found');
      }

      return ResponseHandler.success(res, 'Ticket retrieved', { ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel ticket (user can cancel their own OPEN tickets)
   */
  async cancelTicket(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { id } = req.params;
      const ticket = await supportService.cancelTicket(id, req.user.id);

      return ResponseHandler.success(res, 'Ticket cancelled successfully', { ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add response to ticket
   */
  async addResponse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return ResponseHandler.badRequest(res, 'Message is required');
      }

      const ticket = await supportService.addResponse(id, req.user.id, message, false);

      return ResponseHandler.success(res, 'Response added', { ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get FAQs
   */
  async getFAQs(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as TicketCategory | undefined;
      const faqs = await supportService.getFAQs(category);

      return ResponseHandler.success(res, 'FAQs retrieved', { faqs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get all tickets
   */
  async getAllTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as TicketStatus | undefined;
      const category = req.query.category as TicketCategory | undefined;
      const tickets = await supportService.getAllTickets(status, category);

      return ResponseHandler.success(res, 'Tickets retrieved', { tickets });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update ticket status
   */
  async updateTicketStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return ResponseHandler.badRequest(res, 'Status is required');
      }

      const ticket = await supportService.updateTicketStatus(id, status, req.user.id);

      return ResponseHandler.success(res, 'Ticket status updated', { ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Add admin response
   */
  async addAdminResponse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);

      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return ResponseHandler.badRequest(res, 'Message is required');
      }

      const ticket = await supportService.addResponse(id, req.user.id, message, true);

      return ResponseHandler.success(res, 'Admin response added', { ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get all FAQs
   */
  async getAllFAQs(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as TicketCategory | undefined;
      const faqs = await supportService.getAllFAQs(category);

      return ResponseHandler.success(res, 'FAQs retrieved', { faqs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Create FAQ
   */
  async createFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, question, answer, order, active } = req.body;

      if (!category || !question || !answer || order === undefined) {
        return ResponseHandler.badRequest(res, 'Category, question, answer, and order are required');
      }

      const faq = await supportService.createFAQ({
        category,
        question,
        answer,
        order,
        active
      });

      return ResponseHandler.success(res, 'FAQ created', { faq }, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update FAQ
   */
  async updateFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { category, question, answer, order, active } = req.body;

      const faq = await supportService.updateFAQ(id, {
        category,
        question,
        answer,
        order,
        active
      });

      return ResponseHandler.success(res, 'FAQ updated', { faq });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Delete FAQ
   */
  async deleteFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await supportService.deleteFAQ(id);

      return ResponseHandler.success(res, 'FAQ deleted');
    } catch (err) {
      next(err);
    }
  }
}

export default new SupportController();

