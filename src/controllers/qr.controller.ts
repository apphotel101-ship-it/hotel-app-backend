import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { signQRToken, verifyQRToken } from '../lib/jwt';
import { generateQRBuffer } from '../lib/qrcode';
import { uploadBuffer } from '../lib/cloudinary';

// GET /api/v1/qr/resolve?token=  (Public — used before login)
export async function resolveQR(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
  if (!token) { res.status(400).json({ message: 'token query param required' }); return; }

  let payload: Record<string, unknown>;
  try {
    payload = verifyQRToken(token);
  } catch {
    res.status(400).json({ message: 'Invalid or tampered QR token' }); return;
  }

  const roomId = payload.room_id as number;
  const hotelId = payload.hotel_id as number;

  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }

  // Pre-fill with current active guest's name if available
  const activeGuest = await prisma.guest.findFirst({
    where: { roomId, hotelId, isActive: true },
  });

  res.json({
    room_number: room.roomNumber,
    guest_name: activeGuest?.name ?? null,
    hotel_id: hotelId,
  });
}

// GET /api/v1/admin/rooms/:room_id/qr/download  (SUPER_ADMIN)
export async function downloadQR(req: Request, res: Response): Promise<void> {
  const roomId = parseInt(req.params.room_id as string);
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: req.hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }

  if (!room.qrImageUrl) { res.status(404).json({ message: 'QR not generated yet. Use /qr/generate first.' }); return; }

  // Redirect to Cloudinary URL
  res.redirect(room.qrImageUrl);
}

// POST /api/v1/admin/rooms/qr/generate  (SUPER_ADMIN)
export async function generateQR(req: Request, res: Response): Promise<void> {
  const { room_id, hotel_id } = req.body as { room_id: number; hotel_id: number };

  if (hotel_id !== req.hotelId) { res.status(403).json({ message: 'hotel_id mismatch' }); return; }

  const room = await prisma.room.findFirst({ where: { id: room_id, hotelId: req.hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }

  // Sign JWT token with room context
  const qrToken = signQRToken({ room_id, hotel_id });

  // The QR encodes a deep-link URL that the frontend resolves
  const qrData = `${process.env.APP_URL ?? 'http://localhost:3000'}/api/v1/qr/resolve?token=${qrToken}`;

  const buffer = await generateQRBuffer(qrData);
  const imageUrl = await uploadBuffer(buffer, 'hotel-qr-codes');

  await prisma.room.update({
    where: { id: room_id },
    data: { qrToken, qrImageUrl: imageUrl },
  });

  res.json({ room_id, qr_token: qrToken, qr_image_url: imageUrl });
}
