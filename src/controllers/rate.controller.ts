import { Request, Response } from 'express';
import rateService from '../services/rate.service';
import { ResponseHandler } from '../utils/response';

class RateController {
    async getLiveRates(req: Request, res: Response) {
        try {
            const rates = await rateService.getLiveRates();
            return ResponseHandler.success(res, 'Live rates retrieved successfully', rates);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch live rates', 500);
        }
    }

    async updateRates(req: Request, res: Response) {
        try {
            await rateService.updateRates();
            return ResponseHandler.success(res, 'Rates updated successfully');
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to update rates', 500);
        }
    }
}

export default new RateController();

