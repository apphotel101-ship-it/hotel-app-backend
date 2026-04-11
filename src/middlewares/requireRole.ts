import { Request, Response, NextFunction } from 'express';

type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
