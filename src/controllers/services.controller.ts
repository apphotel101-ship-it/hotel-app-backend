import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/v1/services
export async function listServices(_req: Request, res: Response): Promise<void> {
  const services = await prisma.service.findMany({ orderBy: { id: 'asc' } });
  res.json({
    services: services.map((s) => ({
      service_id: s.id,
      service_name: s.name,
      is_billable: s.isBillable,
    })),
  });
}

// POST /api/v1/admin/services
export async function createService(req: Request, res: Response): Promise<void> {
  const { service_name, is_billable } = req.body as { service_name: string; is_billable: boolean };

  const existing = await prisma.service.findUnique({ where: { name: service_name } });
  if (existing) { res.status(409).json({ message: 'Service already exists' }); return; }

  const service = await prisma.service.create({ data: { name: service_name, isBillable: is_billable } });
  res.status(201).json({ service_id: service.id, service_name: service.name, is_billable: service.isBillable });
}

// PATCH /api/v1/admin/services/:service_id
export async function updateService(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.service_id as string);
  const { service_name, is_billable } = req.body as { service_name?: string; is_billable?: boolean };

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Service not found' }); return; }

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(service_name && { name: service_name }),
      ...(is_billable !== undefined && { isBillable: is_billable }),
    },
  });
  res.json({ service_id: updated.id, service_name: updated.name, is_billable: updated.isBillable });
}
