import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// POST /api/v1/admin/guests
export async function createGuest(req: Request, res: Response): Promise<void> {
  const { guest_name, room_id, check_in, check_out, mobile_no, govt_id } =
    req.body as {
      guest_name: string;
      room_id: number;
      check_in: string;
      check_out: string;
      mobile_no: string;
      govt_id: string;
    };

  const room = await prisma.room.findFirst({ where: { id: room_id, hotelId: req.hotelId } });
  if (!room) { res.status(404).json({ message: 'Room not found' }); return; }

  const guest = await prisma.guest.create({
    data: {
      hotelId: req.hotelId,
      roomId: room_id,
      name: guest_name,
      checkIn: new Date(check_in),
      checkOut: new Date(check_out),
      mobileNo: mobile_no,
      govtId: govt_id,
    },
  });

  // Mark room as Occupied
  await prisma.room.update({ where: { id: room_id }, data: { status: 'Occupied' } });

  res.status(201).json({
    guest_id: guest.id,
    guest_name: guest.name,
    room_id: guest.roomId,
    check_in: guest.checkIn,
    check_out: guest.checkOut,
    is_active: guest.isActive,
  });
}

// GET /api/v1/admin/guests
export async function listGuests(req: Request, res: Response): Promise<void> {
  const { is_active, room_id, search } = req.query as Record<string, string>;

  const guests = await prisma.guest.findMany({
    where: {
      hotelId: req.hotelId,
      ...(is_active !== undefined && { isActive: is_active === 'true' }),
      ...(room_id && { roomId: parseInt(room_id) }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { room: { roomNumber: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    },
    include: { room: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    guests: guests.map((g) => ({
      guest_id: g.id,
      guest_name: g.name,
      room_number: g.room.roomNumber,
      check_in: g.checkIn,
      check_out: g.checkOut,
      is_active: g.isActive,
    })),
    total: guests.length,
  });
}

// GET /api/v1/admin/guests/:guest_id
export async function getGuest(req: Request, res: Response): Promise<void> {
  const guest = await prisma.guest.findFirst({
    where: { id: parseInt(req.params.guest_id as string), hotelId: req.hotelId },
    include: { room: true },
  });
  if (!guest) { res.status(404).json({ message: 'Guest not found' }); return; }

  res.json({
    guest_id: guest.id,
    guest_name: guest.name,
    room_id: guest.roomId,
    room_number: guest.room.roomNumber,
    check_in: guest.checkIn,
    check_out: guest.checkOut,
    mobile_no: guest.mobileNo,
    govt_id: guest.govtId,
    is_active: guest.isActive,
  });
}

// PATCH /api/v1/admin/guests/:guest_id
export async function updateGuest(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.guest_id as string);
  const guest = await prisma.guest.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!guest) { res.status(404).json({ message: 'Guest not found' }); return; }

  const { check_out, is_active } = req.body as { check_out?: string; is_active?: boolean };

  const updated = await prisma.guest.update({
    where: { id },
    data: {
      ...(check_out && { checkOut: new Date(check_out) }),
      ...(is_active !== undefined && { isActive: is_active }),
    },
  });

  // If deactivating guest, mark room as Available
  if (is_active === false) {
    await prisma.room.update({ where: { id: guest.roomId }, data: { status: 'Available' } });
  }

  res.json({ guest_id: updated.id, check_out: updated.checkOut, is_active: updated.isActive });
}

// GET /api/v1/guest/me/profile
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const guest = await prisma.guest.findUnique({
    where: { id: req.guest!.guest_id },
    include: { room: true },
  });
  if (!guest) { res.status(404).json({ message: 'Guest not found' }); return; }

  res.json({
    guest_name: guest.name,
    room_number: guest.room.roomNumber,
    check_in: guest.checkIn,
    check_out: guest.checkOut,
  });
}

// GET /api/v1/guest/me/history
export async function getMyHistory(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;

  const allOrders = await prisma.order.findMany({
    where: {
      guestId,
      status: { in: ['DELIVERED', 'RESOLVED', 'CANCELLED'] },
    },
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  const orders = allOrders
    .filter((o) => o.isBillable)
    .map((o) => ({
      order_id: o.id,
      service: o.service.name,
      status: o.status,
      total_amount: Number(o.totalAmount),
      created_at: o.createdAt,
    }));

  const requests = allOrders
    .filter((o) => !o.isBillable)
    .map((o) => ({
      order_id: o.id,
      service: o.service.name,
      status: o.status,
      total_amount: Number(o.totalAmount),
      created_at: o.createdAt,
    }));

  const totalBill = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.total_amount, 0);

  res.json({ orders, requests, total_bill: totalBill });
}
