import { Server, Namespace, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import prisma from '../lib/prisma';

export interface ConnectedAdmin {
  adminId: number;
  reminderEnabled: boolean;
}

// Map of socketId → admin info (used by reminder cron)
export const connectedAdmins = new Map<string, ConnectedAdmin>();

let adminNs: Namespace;

export function getAdminNamespace(): Namespace {
  return adminNs;
}

export function setupAdminNamespace(io: Server): void {
  adminNs = io.of('/admin');

  // Auth middleware
  adminNs.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as Record<string, string>)?.token ??
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = verifyAccessToken(token) as Record<string, unknown>;
      // if (payload.type !== 'ADMIN') return next(new Error('Forbidden'));
      socket.data.adminId = payload.admin_id as number;
      socket.data.hotelId = payload.hotel_id as number;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  adminNs.on('connection', async (socket: Socket) => {
    const adminId = socket.data.adminId as number;

    try {
      const admin = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!admin) { socket.disconnect(); return; }

      connectedAdmins.set(socket.id, {
        adminId,
        reminderEnabled: admin.reminderEnabled,
      });

      socket.on('disconnect', () => {
        connectedAdmins.delete(socket.id);
      });
    } catch {
      socket.disconnect();
    }
  });
}
