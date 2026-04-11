import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../socket';

// POST /api/v1/feedback  (Guest)
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const { type, order_id, rating, comment, image_url, is_anonymous } =
    req.body as {
      type: 'FEEDBACK' | 'COMPLAINT';
      order_id?: number;
      rating?: number;
      comment?: string;
      image_url?: string;
      is_anonymous?: boolean;
    };

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) { res.status(404).json({ message: 'Guest not found' }); return; }

  const feedback = await prisma.feedbackComplaint.create({
    data: {
      guestId,
      roomId: guest.roomId,
      orderId: order_id ?? null,
      type,
      rating: rating ?? null,
      comment: comment ?? null,
      imageUrl: image_url ?? null,
      isAnonymous: is_anonymous ?? false,
    },
  });

  // Notify admin if it's a complaint
  if (type === 'COMPLAINT') {
    const notification = await prisma.notification.create({
      data: {
        hotelId: req.hotelId,
        notificationType: 'COMPLAINT',
        referenceId: feedback.id,
        referenceType: 'FEEDBACK',
        message: `New complaint from Room — feedback #${feedback.id}`,
      },
    });

    try {
      getIO().of('/admin').emit('NEW_COMPLAINT', {
        event: 'NEW_COMPLAINT',
        feedback_id: feedback.id,
        notification_id: notification.id,
      });
    } catch { /* socket not ready */ }
  }

  res.status(201).json({ feedback_id: feedback.id, type: feedback.type, status: feedback.status });
}

// GET /api/v1/feedback/me  (Guest)
export async function getMyFeedback(req: Request, res: Response): Promise<void> {
  const feedbacks = await prisma.feedbackComplaint.findMany({
    where: { guestId: req.guest!.guest_id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    feedback: feedbacks.map((f) => ({
      feedback_id: f.id,
      type: f.type,
      rating: f.rating,
      comment: f.comment,
      created_at: f.createdAt,
    })),
  });
}

// GET /api/v1/admin/feedback  (Admin)
export async function listFeedback(req: Request, res: Response): Promise<void> {
  const { type, date_from, date_to } = req.query as Record<string, string>;

  const feedbacks = await prisma.feedbackComplaint.findMany({
    where: {
      room: { hotelId: req.hotelId },
      ...(type && { type: type as 'FEEDBACK' | 'COMPLAINT' }),
      ...(date_from || date_to
        ? {
            createdAt: {
              ...(date_from && { gte: new Date(date_from) }),
              ...(date_to && { lte: new Date(new Date(date_to).getTime() + 86400000) }),
            },
          }
        : {}),
    },
    include: { guest: true, room: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    feedback: feedbacks.map((f) => ({
      feedback_id: f.id,
      type: f.type,
      room_number: f.room.roomNumber,
      guest_name: f.isAnonymous ? 'Anonymous' : f.guest.name,
      comment: f.comment,
      rating: f.rating,
      status: f.status,
    })),
    total: feedbacks.length,
  });
}

// PATCH /api/v1/admin/feedback/:feedback_id/respond  (Admin)
export async function respondToFeedback(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.feedback_id as string);
  const { response_text } = req.body as { response_text: string };

  const feedback = await prisma.feedbackComplaint.findFirst({
    where: { id, room: { hotelId: req.hotelId } },
  });
  if (!feedback) { res.status(404).json({ message: 'Feedback not found' }); return; }

  const updated = await prisma.feedbackComplaint.update({
    where: { id },
    data: { responseText: response_text, status: 'RESOLVED' },
  });

  res.json({ feedback_id: updated.id, status: updated.status, response_text: updated.responseText });
}
