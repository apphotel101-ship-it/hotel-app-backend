import { Request, Response } from 'express';
import { BedType, Prisma, Room, RoomType } from '@prisma/client';
import prisma from '../lib/prisma';

const ROOM_TYPES = new Set<string>(Object.values(RoomType));
const BED_TYPES = new Set<string>(Object.values(BedType));

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  DELUXE: 'Deluxe',
  SUITE: 'Suite',
  STANDARD: 'Standard',
};

const BED_TYPE_LABELS: Record<BedType, string> = {
  KING: 'King',
  QUEEN: 'Queen',
  TWIN: 'Twin',
  SINGLE: 'Single',
};

function normalizeJsonArray(value: Prisma.JsonValue): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function formatRoomListItem(room: Room) {
  return {
    id: room.id,
    hotelId: room.hotelId,
    roomNumber: room.roomNumber,
    qrToken: room.qrToken,
    qrImageUrl: room.qrImageUrl,
    status: room.status,
    createdAt: room.createdAt,
    roomType: ROOM_TYPE_LABELS[room.roomType],
    description: room.description,
    maxOccupancy: room.maxOccupancy,
    bedType: BED_TYPE_LABELS[room.bedType],
    pricePerNight: Number(room.pricePerNight),
    amenities: normalizeJsonArray(room.amenities),
    images: normalizeJsonArray(room.images),
    isActive: room.isActive,
    updatedAt: room.updatedAt,
  };
}

function parseRoomType(v: unknown): RoomType | undefined {
  if (typeof v !== 'string' || !ROOM_TYPES.has(v)) return undefined;
  return v as RoomType;
}

function parseBedType(v: unknown): BedType | undefined {
  if (typeof v !== 'string' || !BED_TYPES.has(v)) return undefined;
  return v as BedType;
}

function parseJsonArrayField(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (Array.isArray(value)) return value as Prisma.InputJsonValue;
  return undefined;
}

// GET /api/v1/admin/rooms
export async function listRooms(req: Request, res: Response): Promise<void> {
  const rows = await prisma.room.findMany({
    where: { hotelId: req.hotelId },
    orderBy: { roomNumber: 'asc' },
  });
  res.json({ rooms: rows.map(formatRoomListItem) });
}

// POST /api/v1/admin/rooms
export async function createRoom(req: Request, res: Response): Promise<void> {
  const {
    room_number,
    status,
    room_type,
    description,
    max_occupancy,
    bed_type,
    price_per_night,
    amenities,
    images,
    is_active,
  } = req.body as Record<string, unknown>;

  if (typeof room_number !== 'string') {
    res.status(400).json({ message: 'room_number is required' });
    return;
  }

  const rt = parseRoomType(room_type);
  const bt = parseBedType(bed_type);
  if (room_type !== undefined && rt === undefined) {
    res.status(400).json({ message: 'Invalid room_type; use DELUXE, SUITE, or STANDARD' });
    return;
  }
  if (bed_type !== undefined && bt === undefined) {
    res.status(400).json({ message: 'Invalid bed_type; use KING, QUEEN, TWIN, or SINGLE' });
    return;
  }

  const amenitiesJson = parseJsonArrayField(amenities);
  const imagesJson = parseJsonArrayField(images);
  if (amenities !== undefined && amenitiesJson === undefined) {
    res.status(400).json({ message: 'amenities must be a JSON array' });
    return;
  }
  if (images !== undefined && imagesJson === undefined) {
    res.status(400).json({ message: 'images must be a JSON array' });
    return;
  }

  const existing = await prisma.room.findUnique({
    where: { hotelId_roomNumber: { hotelId: req.hotelId, roomNumber: room_number } },
  });
  if (existing) { res.status(409).json({ message: 'Room number already exists' }); return; }

  const room = await prisma.room.create({
    data: {
      hotelId: req.hotelId,
      roomNumber: room_number,
      status: typeof status === 'string' ? status : 'Available',
      ...(rt !== undefined && { roomType: rt }),
      ...(bt !== undefined && { bedType: bt }),
      ...(description !== undefined && { description: description === null ? null : String(description) }),
      ...(typeof max_occupancy === 'number' && Number.isInteger(max_occupancy) && max_occupancy > 0 && { maxOccupancy: max_occupancy }),
      ...(typeof price_per_night === 'number' && { pricePerNight: price_per_night }),
      ...(typeof is_active === 'boolean' && { isActive: is_active }),
      ...(amenitiesJson !== undefined && { amenities: amenitiesJson }),
      ...(imagesJson !== undefined && { images: imagesJson }),
    },
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

  const {
    room_number,
    status,
    room_type,
    description,
    max_occupancy,
    bed_type,
    price_per_night,
    amenities,
    images,
    is_active,
  } = req.body as Record<string, unknown>;

  const rt = parseRoomType(room_type);
  const bt = parseBedType(bed_type);
  if (room_type !== undefined && rt === undefined) {
    res.status(400).json({ message: 'Invalid room_type; use DELUXE, SUITE, or STANDARD' });
    return;
  }
  if (bed_type !== undefined && bt === undefined) {
    res.status(400).json({ message: 'Invalid bed_type; use KING, QUEEN, TWIN, or SINGLE' });
    return;
  }

  const amenitiesJson = parseJsonArrayField(amenities);
  const imagesJson = parseJsonArrayField(images);
  if (amenities !== undefined && amenitiesJson === undefined) {
    res.status(400).json({ message: 'amenities must be a JSON array' });
    return;
  }
  if (images !== undefined && imagesJson === undefined) {
    res.status(400).json({ message: 'images must be a JSON array' });
    return;
  }

  const updated = await prisma.room.update({
    where: { id },
    data: {
      ...(typeof room_number === 'string' && { roomNumber: room_number }),
      ...(typeof status === 'string' && { status }),
      ...(rt !== undefined && { roomType: rt }),
      ...(bt !== undefined && { bedType: bt }),
      ...(description !== undefined && { description: description === null ? null : String(description) }),
      ...(typeof max_occupancy === 'number' && Number.isInteger(max_occupancy) && max_occupancy > 0 && { maxOccupancy: max_occupancy }),
      ...(typeof price_per_night === 'number' && { pricePerNight: price_per_night }),
      ...(typeof is_active === 'boolean' && { isActive: is_active }),
      ...(amenitiesJson !== undefined && { amenities: amenitiesJson }),
      ...(imagesJson !== undefined && { images: imagesJson }),
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
