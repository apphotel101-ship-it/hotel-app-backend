import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/v1/auth/guest/login
export async function guestLogin(req: Request, res: Response): Promise<void> {
  const { room_number, guest_name } = req.body as { room_number: string; guest_name: string };

  const guest = await prisma.guest.findFirst({
    where: {
      hotelId: req.hotelId,
      isActive: true,
      name: { equals: guest_name, mode: 'insensitive' },
      room: { roomNumber: room_number },
    },
    include: { room: true },
  });

  if (!guest) { res.status(401).json({ message: 'Invalid room number or guest name' }); return; }

  const payload = { guest_id: guest.id, room_id: guest.roomId, hotel_id: guest.hotelId, type: 'GUEST' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      guestId: guest.id,
      userType: 'GUEST',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    guest: {
      guest_id: guest.id,
      guest_name: guest.name,
      room_number: guest.room.roomNumber,
      check_in: guest.checkIn,
      check_out: guest.checkOut,
    },
  });
}

// POST /api/v1/auth/admin/login
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const admin = await prisma.admin.findFirst({ where: { email, hotelId: req.hotelId } });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ message: 'Invalid email or password' }); return;
  }

  const payload = { admin_id: admin.id, hotel_id: admin.hotelId, role: admin.role, type: 'ADMIN' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      adminId: admin.id,
      userType: 'ADMIN',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    admin: { admin_id: admin.id, email: admin.email, role: admin.role },
  });
}

// POST /api/v1/auth/refresh
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as { refresh_token: string };
  if (!refresh_token) { res.status(400).json({ message: 'refresh_token required' }); return; }

  let payload: Record<string, unknown>;
  try {
    payload = verifyRefreshToken(refresh_token);
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' }); return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refresh_token) } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    res.status(401).json({ message: 'Refresh token revoked or expired' }); return;
  }

  const { type, guest_id, admin_id, room_id, hotel_id, role } = payload;
  let newPayload: Record<string, unknown>;

  if (type === 'GUEST') {
    newPayload = { guest_id, room_id, hotel_id, type: 'GUEST' };
  } else {
    newPayload = { admin_id, hotel_id, role, type: 'ADMIN' };
  }

  res.json({ access_token: signAccessToken(newPayload) });
}

// POST /api/v1/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as { refresh_token: string };
  if (refresh_token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refresh_token) },
      data: { revoked: true },
    });
  }
  res.json({ message: 'Logged out' });
}

// GET /api/v1/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  if (req.guest) {
    const guest = await prisma.guest.findUnique({ where: { id: req.guest.guest_id } });
    if (!guest) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ id: guest.id, type: 'guest', name: guest.name, role: null });
    return;
  }
  if (req.admin) {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.admin_id } });
    if (!admin) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ id: admin.id, type: 'admin', name: admin.email, role: admin.role });
    return;
  }
  res.status(401).json({ message: 'Unauthorized' });
}
