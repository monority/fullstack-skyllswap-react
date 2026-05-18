import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required in environment variables');
    }

    return secret;
};

export interface JwtPayload {
    sub: string;
    email?: string;
    name?: string;
    type?: 'access' | 'refresh';
    iat?: number;
    exp?: number;
}

declare global {
    namespace Express {
        interface Request {
            auth?: JwtPayload;
        }
    }
}

export class AuthMiddleware {
    private static instance: AuthMiddleware;

    private constructor() { }

    static getInstance(): AuthMiddleware {
        if (!AuthMiddleware.instance) {
            AuthMiddleware.instance = new AuthMiddleware();
        }
        return AuthMiddleware.instance;
    }

    verifyToken(req: Request, res: Response, next: NextFunction): void {
        const header = req.headers.authorization || '';
        const headerParts = header.split(' ');
        const scheme = headerParts[0] || '';
        const token = headerParts[1] || '';
        const cookieToken = req.cookies ? req.cookies[process.env.SESSION_COOKIE_NAME || 'skyllswap_session'] : null;
        const accessToken = scheme === 'Bearer' && token ? token : cookieToken ?? null;

        if (!accessToken) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        try {
            const payload = jwt.verify(accessToken, getJwtSecret()) as JwtPayload;
            req.auth = payload;
            next();
        } catch (error) {
            if ((error as Error).name === 'TokenExpiredError') {
                res.status(401).json({
                    message: 'Invalid or expired token',
                    code: 'TOKEN_EXPIRED'
                });
                return;
            }

            res.status(401).json({
                message: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
        }
    }

    verifyRefreshToken(req: Request, res: Response, next: NextFunction): void {
        const refreshToken = req.cookies ? req.cookies[process.env.REFRESH_TOKEN_COOKIE_NAME || 'skyllswap_refresh'] : null;

        if (!refreshToken) {
            res.status(401).json({ message: 'Refresh token required' });
            return;
        }

        try {
            const payload = jwt.verify(refreshToken, getJwtSecret()) as JwtPayload;

            if (payload.type !== 'refresh') {
                res.status(401).json({ message: 'Invalid refresh token type' });
                return;
            }

            req.auth = payload;
            next();
        } catch {
            res.status(401).json({
                message: 'Invalid or expired refresh token',
                code: 'REFRESH_TOKEN_INVALID'
            });
        }
    }

    signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string | number): string {
        return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
    }

    /**
     * Vérifier si l'utilisateur a un rôle spécifique
     */
    requireRole(_role: string) {
        return (req: Request, res: Response, next: NextFunction): void => {
            if (!req.auth) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            // Pour l'instant, tous les utilisateurs ont le même rôle
            // À étendre pour supporter différents rôles
            next();
        };
    }

    /**
     * Vérifier si l'utilisateur est le propriétaire de la ressource
     */
    requireOwnership(_paramName: string = 'id') {
        return (req: Request, res: Response, next: NextFunction): void => {
            if (!req.auth) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            // Vérifier l'accès à la ressource
            // À implémenter selon les besoins de l'application
            next();
        };
    }

    /**
     * Loguer les tentatives d'authentification échouées
     */
    logFailedAttempt(req: Request, error: string): void {
        const ip = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const endpoint = req.originalUrl;

        console.warn('🔐 Failed authentication attempt', {
            ip,
            userAgent,
            endpoint,
            error,
            timestamp: new Date().toISOString()
        });
    }
}

export const authMiddleware = AuthMiddleware.getInstance();