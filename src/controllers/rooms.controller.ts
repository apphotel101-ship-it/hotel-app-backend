import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/v1/admin/rooms
export async function listRooms(req: Request, res: Response): Promise<void> {
  const rooms = await prisma.room.findMany({
    where: { hotelId: req.hotelId },
    orderBy: { roomNumber: 'asc' },
  });
  res.json({ rooms });
}

// POST /api/v1/admin/rooms
export async function createRoom(req: Request, res: Response): Promise<void> {
  const { room_number, status } = req.body as { room_number: string; status?: string };

  const existing = await prisma.room.findUnique({
    where: { hotelId_roomNumber: { hotelId: req.hotelId, roomNumber: room_number } },
  });
  if (existing) { res.status(409).json({ message: 'Room number already exists' }); return; }

  const room = await prisma.room.create({
    data: { hotelId: req.hotelId, roomNumber: room_number, status: status ?? 'Available' },
  });
  res.status(201).json({ room_id: room.id, room_number: room.roomNumber, status: room.status });
}

// GET /api/v1/admin/rooms/:room_id
export async function getRoom(req: Request, res: Response): Promise<void> {
  const room = await prisma.room.findFirst({
    where: { id: parseInt(req.params.room_id as string), hotelId: req.hotelId },
  });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }
  res.json(room);
}

// PATCH /api/v1/admin/rooms/:room_id
export async function updateRoom(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.room_id as string);
  const room = await prisma.room.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }

  const { room_number, status } = req.body as { room_number?: string; status?: string };
  const updated = await prisma.room.update({
    where: { id },
    data: {
      ...(room_number && { roomNumber: room_number }),
      ...(status && { status }),
    },
  });
  res.json({ room_id: updated.id, room_number: updated.roomNumber, status: updated.status });
}

// DELETE /api/v1/admin/rooms/:room_id
export async function deleteRoom(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.room_id as string);
  const room = await prisma.room.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }
  await prisma.room.delete({ where: { id } });
  res.json({ message: 'Room deleted' });
}
