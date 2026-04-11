import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/v1/admin/dashboard/overview
export async function getOverview(req: Request, res: Response): Promise<void> {
  const { date, date_from, date_to } = req.query as Record<string, string>;
  const hotelId = req.hotelId;

  let dateFilter: { gte?: Date; lt?: Date } = {};
  if (date) {
    dateFilter = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };
  } else if (date_from || date_to) {
    dateFilter = {
      ...(date_from && { gte: new Date(date_from) }),
      ...(date_to && { lt: new Date(new Date(date_to).getTime() + 86400000) }),
    };
  }

  const [total, pending, inProgress, resolvedToday] = await Promise.all([
    prisma.order.count({ where: { hotelId, ...(date || date_from || date_to ? { createdAt: dateFilter } : {}) } }),
    prisma.order.count({ where: { hotelId, status: 'PLACED' } }),
    prisma.order.count({ where: { hotelId, status: 'IN_PROGRESS' } }),
    prisma.order.count({
      where: {
        hotelId,
        status: { in: ['DELIVERED', 'RESOLVED'] },
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  res.json({ total, pending, in_progress: inProgress, resolved_today: resolvedToday });
}

// GET /api/v1/admin/dashboard/orders
export async function getOrderStats(req: Request, res: Response): Promise<void> {
  const { date_from, date_to, service_id, room_id, status } = req.query as Record<string, string>;
  const hotelId = req.hotelId;

  const where = {
    hotelId,
    ...(date_from || date_to
      ? {
          createdAt: {
            ...(date_from && { gte: new Date(date_from) }),
            ...(date_to && { lte: new Date(date_to) }),
          },
        }
      : {}),
    ...(service_id && { serviceId: parseInt(service_id) }),
    ...(room_id && { roomId: parseInt(room_id) }),
    ...(status && { status: status as never }),
  };

  const orders = await prisma.order.findMany({
    where,
    include: { service: true, room: true },
  });

  const byService = Object.values(
    orders.reduce<Record<string, { service: string; count: number }>>((acc, o) => {
      const name = o.service.name;
      if (!acc[name]) acc[name] = { service: name, count: 0 };
      acc[name].count++;
      return acc;
    }, {})
  );

  const byRoom = Object.values(
    orders.reduce<Record<string, { room_number: string; count: number }>>((acc, o) => {
      const rn = o.room.roomNumber;
      if (!acc[rn]) acc[rn] = { room_number: rn, count: 0 };
      acc[rn].count++;
      return acc;
    }, {})
  );

  const byStatus = Object.values(
    orders.reduce<Record<string, { status: string; count: number }>>((acc, o) => {
      if (!acc[o.status]) acc[o.status] = { status: o.status, count: 0 };
      acc[o.status].count++;
      return acc;
    }, {})
  );

  res.json({ by_service: byService, by_room: byRoom, by_status: byStatus });
}

// GET /api/v1/admin/dashboard/feedback-stats
export async function getFeedbackStats(req: Request, res: Response): Promise<void> {
  const hotelId = req.hotelId;

  const [complaintCount, ratingAgg, complaints] = await Promise.all([
    prisma.feedbackComplaint.count({ where: { room: { hotelId }, type: 'COMPLAINT' } }),
    prisma.feedbackComplaint.aggregate({
      where: { room: { hotelId }, type: 'FEEDBACK', rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.feedbackComplaint.findMany({
      where: { room: { hotelId }, type: 'COMPLAINT' },
      select: { comment: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const recurringIssues = complaints
    .map((c) => c.comment)
    .filter((c): c is string => !!c)
    .slice(0, 5);

  res.json({
    complaint_count: complaintCount,
    avg_rating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
    recurring_issues: recurringIssues,
  });
}

// GET /api/v1/admin/dashboard/guest-satisfaction
export async function getGuestSatisfaction(req: Request, res: Response): Promise<void> {
  const hotelId = req.hotelId;

  const services = await prisma.service.findMany();
  const results = await Promise.all(
    services.map(async (s) => {
      const agg = await prisma.feedbackComplaint.aggregate({
        where: {
          type: 'FEEDBACK',
          rating: { not: null },
          order: { hotelId, serviceId: s.id },
        },
        _avg: { rating: true },
      });
      return { service: s.name, avg_rating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : null };
    })
  );

  res.json({ ratings_by_category: results.filter((r) => r.avg_rating !== null) });
}
