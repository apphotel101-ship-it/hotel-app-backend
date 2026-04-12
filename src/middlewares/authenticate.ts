import { Request, Response, NextFunction } from 'express';
import { GuestPayload, AdminPayload } from '../types/auth.types';
import { verifyAccessToken } from '../lib/jwt';

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function authenticateGuest(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const payload = verifyAccessToken(token) as Record<string, unknown>;
    if (payload.type !== 'GUEST' || payload.hotel_id !== req.hotelId) {
      res.status(403).json({ message: 'Forbidden' }); return;
    }
    req.guest = payload as unknown as GuestPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const payload = verifyAccessToken(token) as Record<string, unknown>;
    if (payload.type !== 'ADMIN' || payload.hotel_id !== req.hotelId) {
      res.status(403).json({ message: 'Forbidden' }); return;
    }
    req.admin = payload as unknown as AdminPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const payload = verifyAccessToken(token) as Record<string, unknown>;
    if (payload.hotel_id !== req.hotelId) {
      res.status(403).json({ message: 'Forbidden' }); return;
    }
    if (payload.type === 'GUEST') {
      req.guest = payload as unknown as GuestPayload;
    }
    else if (payload.type === 'ADMIN') {
      req.admin = payload as unknown as AdminPayload;
    }
    else { res.status(403).json({ message: 'Forbidden' }); return; }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
