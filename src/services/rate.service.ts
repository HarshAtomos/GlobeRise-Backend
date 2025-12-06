import { PrismaClient, TokenRate } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';

class RateService {
    // Mock values for GRT and FLUFFY (your platform tokens)
    private getMockRates() {
        // GRT mock values - adjust these as needed
        const grtBasePrice = 0.15; // $0.15 per GRT
        const grtChange24h = (Math.random() * 10 - 5); // Random change between -5% to +5%
        
        // FLUFFY mock values - adjust these as needed
        const fluffyBasePrice = 0.005; // $0.005 per FLUFFY
        const fluffyChange24h = (Math.random() * 15 - 7.5); // Random change between -7.5% to +7.5%
        
        return {
            grt: {
                price: grtBasePrice * (1 + grtChange24h / 100),
                change24h: grtChange24h,
            },
            fluffy: {
                price: fluffyBasePrice * (1 + fluffyChange24h / 100),
                change24h: fluffyChange24h,
            },
        };
    }

    // Fetch rates from CoinGecko API (only USDT)
    private async fetchFromCoinGecko(): Promise<{
        usdt: { price: number; change24h: number };
        grt: { price: number; change24h: number };
        fluffy: { price: number; change24h: number };
    }> {
        try {
            // Only fetch USDT from CoinGecko
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_24hr_change=true'
            );

            if (!response.ok) {
                throw new Error('Failed to fetch rates from CoinGecko');
            }

            const data = await response.json() as {
                tether?: {
                    usd?: number;
                    usd_24h_change?: number;
                };
            };
            const mockRates = this.getMockRates();

            return {
                usdt: {
                    price: data.tether?.usd || 1.0,
                    change24h: data.tether?.usd_24h_change || 0,
                },
                grt: {
                    price: mockRates.grt.price,
                    change24h: mockRates.grt.change24h,
                },
                fluffy: {
                    price: mockRates.fluffy.price,
                    change24h: mockRates.fluffy.change24h,
                },
            };
        } catch (error) {
            console.error('Error fetching rates from CoinGecko:', error);
            // Return cached values or defaults with mock values
            const cached = await this.getCachedRates();
            const mockRates = this.getMockRates();
            
            return {
                usdt: cached.usdt,
                grt: cached.grt.price > 0 ? cached.grt : mockRates.grt,
                fluffy: cached.fluffy.price > 0 ? cached.fluffy : mockRates.fluffy,
            };
        }
    }

    // Get cached rates from database
    private async getCachedRates(): Promise<{
        usdt: { price: number; change24h: number };
        grt: { price: number; change24h: number };
        fluffy: { price: number; change24h: number };
    }> {
        const rates = await prisma.tokenRate.findMany({
            where: {
                symbol: {
                    in: ['USDT', 'GRT', 'FLUFFY'],
                },
            },
        });

        const rateMap = new Map(rates.map((r) => [r.symbol, r]));

        return {
            usdt: {
                price: rateMap.get('USDT')?.price.toNumber() || 1.0,
                change24h: rateMap.get('USDT')?.change24h?.toNumber() || 0,
            },
            grt: {
                price: rateMap.get('GRT')?.price.toNumber() || 0,
                change24h: rateMap.get('GRT')?.change24h?.toNumber() || 0,
            },
            fluffy: {
                price: rateMap.get('FLUFFY')?.price.toNumber() || 0,
                change24h: rateMap.get('FLUFFY')?.change24h?.toNumber() || 0,
            },
        };
    }

    // Update rates in database
    async updateRates(): Promise<void> {
        try {
            const rates = await this.fetchFromCoinGecko();

            // Update or create USDT rate
            await prisma.tokenRate.upsert({
                where: { symbol: 'USDT' },
                update: {
                    price: new Decimal(rates.usdt.price),
                    change24h: new Decimal(rates.usdt.change24h),
                    updatedAt: new Date(),
                },
                create: {
                    symbol: 'USDT',
                    price: new Decimal(rates.usdt.price),
                    change24h: new Decimal(rates.usdt.change24h),
                },
            });

            // Update or create GRT rate
            await prisma.tokenRate.upsert({
                where: { symbol: 'GRT' },
                update: {
                    price: new Decimal(rates.grt.price),
                    change24h: new Decimal(rates.grt.change24h),
                    updatedAt: new Date(),
                },
                create: {
                    symbol: 'GRT',
                    price: new Decimal(rates.grt.price),
                    change24h: new Decimal(rates.grt.change24h),
                },
            });

            // Update or create FLUFFY rate
            await prisma.tokenRate.upsert({
                where: { symbol: 'FLUFFY' },
                update: {
                    price: new Decimal(rates.fluffy.price),
                    change24h: new Decimal(rates.fluffy.change24h),
                    updatedAt: new Date(),
                },
                create: {
                    symbol: 'FLUFFY',
                    price: new Decimal(rates.fluffy.price),
                    change24h: new Decimal(rates.fluffy.change24h),
                },
            });
        } catch (error) {
            console.error('Error updating rates:', error);
            throw error;
        }
    }

    // Get live rates (with cache fallback)
    async getLiveRates(): Promise<{
        usdt: { price: number; change24h: number };
        grt: { price: number; change24h: number };
        fluffy: { price: number; change24h: number };
    }> {
        // Try to get fresh rates, but fall back to cached if API fails
        try {
            await this.updateRates();
        } catch (error) {
            console.warn('Using cached rates due to API error');
        }

        return this.getCachedRates();
    }
}

export default new RateService();

