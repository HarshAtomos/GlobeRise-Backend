import prisma from '../config/database';
import { TicketCategory, TicketStatus, TicketPriority } from '@prisma/client';

class SupportService {
  /**
   * Create a new support ticket
   */
  async createTicket(userId: string, data: {
    category: TicketCategory;
    subject: string;
    message: string;
    priority?: TicketPriority;
  }) {
    return await prisma.supportTicket.create({
      data: {
        userId,
        category: data.category,
        subject: data.subject,
        message: data.message,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN
      }
    });
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(userId: string, status?: TicketStatus) {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return await prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string, userId?: string) {
    const where: any = { id: ticketId };
    if (userId) {
      where.userId = userId;
    }

    return await prisma.supportTicket.findFirst({
      where,
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Cancel ticket (user can cancel their own OPEN tickets only)
   */
  async cancelTicket(ticketId: string, userId: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new Error('Unauthorized: You can only cancel your own tickets');
    }

    if (ticket.status !== TicketStatus.OPEN) {
      throw new Error('Only OPEN tickets can be cancelled');
    }

    return await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED
      }
    });
  }

  /**
   * Add response to ticket
   */
  async addResponse(ticketId: string, userId: string, message: string, isAdmin: boolean = false) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Check if user owns the ticket (if not admin)
    if (!isAdmin && ticket.userId !== userId) {
      throw new Error('Unauthorized: You can only respond to your own tickets');
    }

    // Update ticket status
    let newStatus = ticket.status;
    if (ticket.status === TicketStatus.OPEN && isAdmin) {
      newStatus = TicketStatus.IN_PROGRESS;
    } else if (ticket.status === TicketStatus.IN_PROGRESS && !isAdmin) {
      newStatus = TicketStatus.OPEN;
    } else if (ticket.status === TicketStatus.ANSWERED && !isAdmin) {
      newStatus = TicketStatus.OPEN;
    }

    // For simplicity, we'll store responses in the adminResponse field
    // In production, you might want a separate TicketResponse model
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: newStatus,
        adminResponse: isAdmin 
          ? (ticket.adminResponse ? `${ticket.adminResponse}\n\n---\n[Admin Response - ${new Date().toLocaleString()}]\n${message}` : `[Admin Response - ${new Date().toLocaleString()}]\n${message}`)
          : (ticket.adminResponse ? `${ticket.adminResponse}\n\n---\n[User Response - ${new Date().toLocaleString()}]\n${message}` : `[User Response - ${new Date().toLocaleString()}]\n${message}`),
        respondedBy: isAdmin ? userId : ticket.respondedBy,
        respondedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return updatedTicket;
  }

  /**
   * Get all active FAQs
   */
  async getFAQs(category?: TicketCategory) {
    const where: any = { active: true };
    if (category) {
      where.category = category;
    }

    return await prisma.fAQ.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ]
    });
  }

  /**
   * Admin: Get all tickets
   */
  async getAllTickets(status?: TicketStatus, category?: TicketCategory) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }

    return await prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Admin: Update ticket status
   */
  async updateTicketStatus(ticketId: string, status: TicketStatus, adminId: string) {
    return await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Admin: Get all FAQs
   */
  async getAllFAQs(category?: TicketCategory) {
    const where: any = {};
    if (category) {
      where.category = category;
    }

    return await prisma.fAQ.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ]
    });
  }

  /**
   * Admin: Create FAQ
   */
  async createFAQ(data: {
    category: TicketCategory;
    question: string;
    answer: string;
    order: number;
    active?: boolean;
  }) {
    return await prisma.fAQ.create({
      data: {
        category: data.category,
        question: data.question,
        answer: data.answer,
        order: data.order,
        active: data.active !== undefined ? data.active : true
      }
    });
  }

  /**
   * Admin: Update FAQ
   */
  async updateFAQ(id: string, data: {
    category?: TicketCategory;
    question?: string;
    answer?: string;
    order?: number;
    active?: boolean;
  }) {
    return await prisma.fAQ.update({
      where: { id },
      data
    });
  }

  /**
   * Admin: Delete FAQ
   */
  async deleteFAQ(id: string) {
    return await prisma.fAQ.delete({
      where: { id }
    });
  }
}

export default new SupportService();

