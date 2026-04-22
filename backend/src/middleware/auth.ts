import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-development-only';

export function authenticateJWT(req: any, res: any, next: NextFunction) {
  // First try to get token from Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // Fall back to cookie
    token = req.cookies?.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = {
      id: payload.id,
      email: payload.email,
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function generateTokens(user: { id: string; email: string }) {
  const accessToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '15m',
  });
  
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}
