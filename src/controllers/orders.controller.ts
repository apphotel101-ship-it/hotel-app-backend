import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../socket';

// Local union — structurally matches Prisma's generated OrderStatus
type OrderStatus =
  | 'PLACED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'DELIVERED'
  | 'RESOLVED'
  | 'CANCELLED';

const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'READY'];
const HISTORY_STATUSES: OrderStatus[] = ['DELIVERED', 'RESOLVED', 'CANCELLED'];

function emitStatusUpdate(orderId: number, prevStatus: OrderStatus, nextStatus: OrderStatus) {
  try {
    getIO().of('/guest').to(`order-${orderId}`).emit('STATUS_UPDATE', {
      event: 'STATUS_UPDATE',
      order_id: orderId,
      status: nextStatus,
      old_status: prevStatus,
      new_status: nextStatus,
      updated_at: new Date().toISOString(),
    });
  } catch { /* socket not ready */ }
}

function emitAdminUpdate(event: string, payload: object) {
  try {
    getIO().of('/admin').emit(event, payload);
  } catch { /* socket not ready */ }
}

// GET /api/v1/orders/active  (Guest)
export async function getActiveOrders(req: Request, res: Response): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { guestId: req.guest!.guest_id, status: { in: ACTIVE_STATUSES } },
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    orders: orders.map((o) => ({
      order_id: o.id,
      service: o.service.name,
      status: o.status,
      total_amount: Number(o.totalAmount),
    })),
  });
}

// GET /api/v1/orders  (Both)
export async function listOrders(req: Request, res: Response): Promise<void> {
  // Now extracting from req.body instead of req.query
  const { status, service_id, room_id, date } = req.body; 
  
  const isGuest = !!req.guest;
  const isAdmin = !!req.admin;

  const orders = await prisma.order.findMany({
    where: {
      hotelId: req.hotelId,
      ...(isGuest && { guestId: req.guest!.guest_id }),
      
      // Since it's a JSON body, status is already a clean array or string
      ...(status && { 
        status: Array.isArray(status) 
          ? { in: status as OrderStatus[] } 
          : (status as OrderStatus) 
      }),

      ...(service_id && { serviceId: parseInt(service_id) }),
      ...(isAdmin && room_id && { roomId: parseInt(room_id) }),
      ...(date && {
        createdAt: {
          gte: new Date(date),
          lt: new Date(new Date(date).getTime() + 86400000),
        },
      }),
    },
    include: { service: true, guest: true, room: true, items: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    orders: orders.map((o) => ({
      order_id: o.id,
      guest_name: o.guest.name,
      room_number: o.room.roomNumber,
      service: o.service.name,
      status: o.status,
      total_amount: Number(o.totalAmount),
      created_at: o.createdAt,
      items: o.items.reduce<Record<string, number>>((acc, i) => {
        acc[i.nameSnapshot] = (acc[i.nameSnapshot] ?? 0) + i.quantity;
        return acc;
      }, {}),
    })),
    total: orders.length,
  });
}

// GET /api/v1/orders/:order_id  (Both)
export async function getOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);
  const isGuest = !!req.guest;

  const order = await prisma.order.findFirst({
    where: {
      id,
      hotelId: req.hotelId,
      ...(isGuest && { guestId: req.guest!.guest_id }),
    },
    include: { service: true, items: true },
  });

  if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

  res.json({
    order_id: order.id,
    service: order.service.name,
    status: order.status,
    instructions: order.instructions,
    ...(req.admin && { admin_comment: order.adminComment }),
    total_amount: Number(order.totalAmount),
    is_billable: order.isBillable,
    scheduled_at: order.scheduledAt,
    items: order.items.map((i) => ({
      name_snapshot: i.nameSnapshot,
      price_snapshot: Number(i.priceSnapshot),
      quantity: i.quantity,
      image_snapshot: i.imageSnapshot,
    })),
  });
}

// POST /api/v1/orders/:order_id/schedule  (Guest)
export async function scheduleOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);
  const { scheduled_at } = req.body as { scheduled_at: string };

  const order = await prisma.order.findFirst({ where: { id, guestId: req.guest!.guest_id } });
  if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
  if (!ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
    res.status(400).json({ message: 'Cannot schedule a completed or cancelled order' }); return;
  }

  const updated = await prisma.order.update({ where: { id }, data: { scheduledAt: new Date(scheduled_at) } });
  res.json({ order_id: updated.id, scheduled_at: updated.scheduledAt });
}

// PATCH /api/v1/orders/:order_id/cancel  (Both)
export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);
  const isGuest = !!req.guest;

  const order = await prisma.order.findFirst({
    where: { id, hotelId: req.hotelId, ...(isGuest && { guestId: req.guest!.guest_id }) },
  });

  if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
  if (isGuest && order.status !== 'PLACED') {
    res.status(400).json({ message: 'Guests can only cancel orders in PLACED status' }); return;
  }
  if (order.status === 'CANCELLED') {
    res.status(400).json({ message: 'Order already cancelled' }); return;
  }

  const previousStatus = order.status as OrderStatus;
  const updated = await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  emitStatusUpdate(id, previousStatus, 'CANCELLED');
  emitAdminUpdate('ORDER_STATUS_UPDATED', {
    event: 'ORDER_STATUS_UPDATED',
    order_id: id,
    old_status: previousStatus,
    status: 'CANCELLED',
    new_status: 'CANCELLED',
    updated_at: new Date().toISOString(),
  });
  res.json({ order_id: updated.id, status: updated.status });
}

// PATCH /api/v1/admin/orders/:order_id/status  (Admin)
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);
  const { status, comment } = req.body as { status: OrderStatus; comment?: string | null };

  const order = await prisma.order.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
  const currentStatus = order.status as OrderStatus;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(comment !== undefined && {
        adminComment: comment === null || comment === '' ? null : comment,
      }),
    },
  });
  emitStatusUpdate(id, currentStatus, status);
  emitAdminUpdate('ORDER_STATUS_UPDATED', {
    event: 'ORDER_STATUS_UPDATED',
    order_id: id,
    old_status: currentStatus,
    status,
    new_status: status,
    comment: updated.adminComment ?? null,
    updated_at: new Date().toISOString(),
  });
  res.json({
    order_id: updated.id,
    status: updated.status,
    comment: updated.adminComment ?? null,
  });
}

// PATCH /api/v1/admin/orders/:order_id/acknowledge  (Admin)
export async function acknowledgeOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);

  const order = await prisma.order.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

  const updated = await prisma.order.update({ where: { id }, data: { status: 'ACKNOWLEDGED' } });
  const previousStatus = order.status as OrderStatus;
  emitStatusUpdate(id, previousStatus, 'ACKNOWLEDGED');
  emitAdminUpdate('ORDER_STATUS_UPDATED', {
    event: 'ORDER_STATUS_UPDATED',
    order_id: id,
    old_status: previousStatus,
    status: 'ACKNOWLEDGED',
    new_status: 'ACKNOWLEDGED',
    updated_at: new Date().toISOString(),
  });
  res.json({ order_id: updated.id, status: updated.status });
}

// PATCH /api/v1/orders/:order_id/reopen  (Guest — Maintenance)
export async function reopenOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);

  const order = await prisma.order.findFirst({
    where: { id, guestId: req.guest!.guest_id, status: 'RESOLVED' },
  });
  if (!order) { res.status(404).json({ message: 'Resolved order not found' }); return; }

  const updated = await prisma.order.update({ where: { id }, data: { status: 'PLACED' } });

  await prisma.notification.create({
    data: {
      hotelId: req.hotelId,
      notificationType: 'ORDER',
      referenceId: id,
      referenceType: 'ORDER',
      message: `Order #${id} reopened by guest`,
    },
  });
  emitAdminUpdate('NEW_ORDER', { event: 'NEW_ORDER', order_id: id, alarm: true });
  emitStatusUpdate(id, 'RESOLVED', 'PLACED');
  res.json({ order_id: updated.id, status: updated.status });
}

// PATCH /api/v1/orders/:order_id/guest-confirm  (Guest — Maintenance)
export async function guestConfirmOrder(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.order_id as string);

  const order = await prisma.order.findFirst({
    where: {
      id,
      guestId: req.guest!.guest_id,
      status: { in: ['IN_PROGRESS', 'READY'] as OrderStatus[] },
    },
  });
  if (!order) { res.status(404).json({ message: 'Order not found or not in a confirmable state' }); return; }

  const previousStatus = order.status as OrderStatus;
  const updated = await prisma.order.update({ where: { id }, data: { status: 'RESOLVED' } });
  emitAdminUpdate('ORDER_STATUS_UPDATED', {
    event: 'ORDER_STATUS_UPDATED',
    order_id: id,
    old_status: previousStatus,
    status: 'RESOLVED',
    new_status: 'RESOLVED',
    updated_at: new Date().toISOString(),
  });
  res.json({ order_id: updated.id, status: updated.status });
}

export { ACTIVE_STATUSES, HISTORY_STATUSES };
