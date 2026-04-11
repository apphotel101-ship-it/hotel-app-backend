import { Request, Response, NextFunction } from 'express';

export function hotelMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const id = parseInt(process.env.HOTEL_ID ?? '0', 10);
  if (!id) throw new Error('HOTEL_ID env variable is not set or invalid');
  req.hotelId = id;
  next();
}
