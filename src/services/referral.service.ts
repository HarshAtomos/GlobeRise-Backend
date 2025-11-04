import prisma from '../config/database';
import blockchainService from './blockchain.mock.service';

class ReferralService {
  // Returns first-level children (max 16) with counts and volume
  async getDirectTree(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const children = await prisma.user.findMany({
      where: { referredById: userId },
      take: 16,
      select: {
        id: true,
        email: true,
      },
    });

    const enriched = await Promise.all(
      children.map(async (child) => {
        const directCount = await prisma.user.count({ where: { referredById: child.id } });
        const teamCount = await this.countTeam(child.id);
        const teamVolume = await this.sumTeamVolume(child.id);
        return { ...child, directCount, teamCount, teamVolume };
      })
    );

    return {
      myCode: user.referralCode,
      referrals: enriched,
    };
  }

  private async countTeam(rootId: string): Promise<number> {
    const queue = [rootId];
    let count = 0;
    while (queue.length) {
      const id = queue.shift()!;
      const children = await prisma.user.findMany({ where: { referredById: id }, select: { id: true } });
      count += children.length;
      queue.push(...children.map((c) => c.id));
    }
    return count;
  }

  private async sumTeamVolume(rootId: string): Promise<number> {
    // placeholder, uses mock blockchain balance
    const queue = [rootId];
    let sum = 0;
    while (queue.length) {
      const id = queue.shift()!;
      sum += await blockchainService.getStakedBalance(id);
      const children = await prisma.user.findMany({ where: { referredById: id }, select: { id: true } });
      queue.push(...children.map((c) => c.id));
    }
    return sum;
  }
}

export default new ReferralService();


