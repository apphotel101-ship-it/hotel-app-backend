import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const QR_SECRET = process.env.QR_SECRET!;

export function signAccessToken(payload: object): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: object): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): Record<string, unknown> {
  return jwt.verify(token, ACCESS_SECRET) as Record<string, unknown>;
}

export function verifyRefreshToken(token: string): Record<string, unknown> {
  return jwt.verify(token, REFRESH_SECRET) as Record<string, unknown>;
}

export function signQRToken(payload: object): string {
  return jwt.sign(payload, QR_SECRET);
}

export function verifyQRToken(token: string): Record<string, unknown> {
  return jwt.verify(token, QR_SECRET) as Record<string, unknown>;
}
