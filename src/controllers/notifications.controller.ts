import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/v1/admin/notifications
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const { is_read, type } = req.query as Record<string, string>;

  const notifications = await prisma.notification.findMany({
    where: {
      hotelId: req.hotelId,
      ...(is_read !== undefined && { isRead: is_read === 'true' }),
      ...(type && { notificationType: type }),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    notifications: notifications.map((n) => ({
      notification_id: n.id,
      notification_type: n.notificationType,
      reference_id: n.referenceId,
      reference_type: n.referenceType,
      message: n.message,
      is_read: n.isRead,
      created_at: n.createdAt,
    })),
  });
}

// GET /api/v1/admin/notifications/unread-count
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await prisma.notification.count({
    where: { hotelId: req.hotelId, isRead: false },
  });
  res.json({ count });
}

// PATCH /api/v1/admin/notifications/:id/read
export async function markRead(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const notification = await prisma.notification.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!notification) { res.status(404).json({ message: 'Notification not found' }); return; }

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  res.json({ notification_id: updated.id, is_read: updated.isRead });
}

// PATCH /api/v1/admin/notifications/read-all
export async function markAllRead(req: Request, res: Response): Promise<void> {
  await prisma.notification.updateMany({
    where: { hotelId: req.hotelId, isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'All notifications marked read' });
}
