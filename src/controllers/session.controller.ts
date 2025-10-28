import { Request, Response, NextFunction } from 'express';
import sessionService from '../services/session.service';
import { ResponseHandler } from '../utils/response';

class SessionController {
    // Get all active sessions for the current user
    async getMySessions(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const sessions = await sessionService.getActiveSessions(req.user.id);

            // Mark current session if we have refresh token info
            // This would require passing current session ID through request
            // For now, we'll leave all as non-current
            const sessionsWithMetadata = sessions.map((session) => ({
                ...session,
                device: sessionService.parseUserAgent(session.userAgent || ''),
            }));

            return ResponseHandler.success(res, 'Sessions retrieved successfully', {
                sessions: sessionsWithMetadata,
            });
        } catch (error) {
            next(error);
        }
    }

    // Revoke a specific session
    async revokeSession(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const { sessionId } = req.params;

            await sessionService.revokeSession(sessionId, req.user.id);

            return ResponseHandler.success(res, 'Session revoked successfully');
        } catch (error) {
            next(error);
        }
    }
}

export default new SessionController();


