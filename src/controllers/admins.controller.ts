import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

// POST /api/v1/admin/admins
export async function createAdmin(req: Request, res: Response): Promise<void> {
  const { email, password, role } = req.body as { email: string; password: string; role: string };

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ message: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({
    data: { hotelId: req.hotelId, email, passwordHash, role: role as never },
  });

  res.status(201).json({ admin_id: admin.id, email: admin.email, role: admin.role });
}

// GET /api/v1/admin/admins
export async function listAdmins(req: Request, res: Response): Promise<void> {
  const admins = await prisma.admin.findMany({
    where: { hotelId: req.hotelId },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    admins: admins.map((a) => ({
      admin_id: a.id,
      email: a.email,
      role: a.role,
      created_at: a.createdAt,
    })),
  });
}

// PATCH /api/v1/admin/admins/:admin_id
export async function updateAdmin(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.admin_id as string);
  const admin = await prisma.admin.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!admin) { res.status(404).json({ message: 'Admin not found' }); return; }

  const { role, password } = req.body as { role?: string; password?: string };

  const updated = await prisma.admin.update({
    where: { id },
    data: {
      ...(role && { role: role as never }),
      ...(password && { passwordHash: await bcrypt.hash(password, 12) }),
    },
  });

  res.json({ admin_id: updated.id, role: updated.role });
}

// DELETE /api/v1/admin/admins/:admin_id
export async function deleteAdmin(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.admin_id as string);

  // Prevent deleting self
  if (id === req.admin!.admin_id) {
    res.status(400).json({ message: 'Cannot delete your own account' }); return;
  }

  const admin = await prisma.admin.findFirst({ where: { id, hotelId: req.hotelId } });
  if (!admin) { res.status(404).json({ message: 'Admin not found' }); return; }

  await prisma.admin.delete({ where: { id } });
  res.json({ message: 'Staff account removed' });
}
