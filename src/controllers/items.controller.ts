import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/v1/items/search?q=
export async function searchItems(req: Request, res: Response): Promise<void> {
  const q = (req.query.q as string) ?? '';

  const items = await prisma.item.findMany({
    where: {
      hotelId: req.hotelId,
      isAvailable: true,
      name: { contains: q, mode: 'insensitive' },
    },
    include: { service: true },
  });

  res.json({
    items: items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      item_price: Number(i.price),
      service_id: i.serviceId,
      service_name: i.service.name,
      image_url: i.imageUrl,
      is_available: i.isAvailable,
    })),
  });
}

// GET /api/v1/services/:service_id/items
export async function listItemsByService(req: Request, res: Response): Promise<void> {
  const serviceId = parseInt(req.params.service_id as string);

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) { res.status(404).json({ message: 'Service not found' }); return; }

  const items = await prisma.item.findMany({
    where: { hotelId: req.hotelId, serviceId, isAvailable: true },
  });

  res.json({
    service_id: service.id,
    service_name: service.name,
    items: items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      item_price: Number(i.price),
      image_url: i.imageUrl,
      is_available: i.isAvailable,
    })),
  });
}

// GET /api/v1/items/:item_id
export async function getItem(req: Request, res: Response): Promise<void> {
  const item = await prisma.item.findFirst({
    where: { id: parseInt(req.params.item_id as string), hotelId: req.hotelId },
  });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }

  res.json({
    item_id: item.id,
    item_name: item.name,
    item_description: item.description,
    item_price: Number(item.price),
    image_url: item.imageUrl,
    is_available: item.isAvailable,
    service_id: item.serviceId,
  });
}

// POST /api/v1/admin/items
export async function createItem(req: Request, res: Response): Promise<void> {
  const { item_name, item_price, service_id, image_url, item_description } =
    req.body as {
      item_name: string;
      item_price: number;
      service_id: number;
      image_url?: string;
      item_description?: string;
    };

  const service = await prisma.service.findUnique({ where: { id: service_id } });
  if (!service) { res.status(404).json({ message: 'Service not found' }); return; }

  const item = await prisma.item.create({
    data: {
      hotelId: req.hotelId,
      serviceId: service_id,
      name: item_name,
      price: item_price,
      imageUrl: image_url,
      description: item_description,
    },
  });

  res.status(201).json({ item_id: item.id, item_name: item.name, is_available: item.isAvailable });
}

// PATCH /api/v1/admin/items/:item_id
export async function updateItem(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.item_id as string);
  const item = await prisma.item.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }

  const { item_name, item_price, image_url, item_description } =
    req.body as { item_name?: string; item_price?: number; image_url?: string; item_description?: string };

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(item_name && { name: item_name }),
      ...(item_price !== undefined && { price: item_price }),
      ...(image_url !== undefined && { imageUrl: image_url }),
      ...(item_description !== undefined && { description: item_description }),
    },
  });

  res.json({ item_id: updated.id, item_name: updated.name, item_price: Number(updated.price) });
}

// PATCH /api/v1/admin/items/:item_id/availability
export async function updateItemAvailability(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.item_id as string);
  const item = await prisma.item.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }

  const { is_available } = req.body as { is_available: boolean };
  const updated = await prisma.item.update({ where: { id }, data: { isAvailable: is_available } });
  res.json({ item_id: updated.id, is_available: updated.isAvailable });
}

// DELETE /api/v1/admin/items/:item_id
export async function deleteItem(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.item_id as string);
  const item = await prisma.item.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
  await prisma.item.delete({ where: { id } });
  res.json({ message: 'Item deleted' });
}
