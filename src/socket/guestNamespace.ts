import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';

export function setupGuestNamespace(io: Server): void {
  const guestNs = io.of('/guest');

  // Auth middleware
  guestNs.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as Record<string, string>)?.token ??
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = verifyAccessToken(token) as Record<string, unknown>;
      // if (payload.type !== 'GUEST') return next(new Error('Forbidden'));
      socket.data.guestId = payload.guest_id as number;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  guestNs.on('connection', (socket: Socket) => {
    // Guest subscribes to real-time updates for a specific order
    socket.on('subscribe_order', (orderId: number) => {
      socket.join(`order-${orderId}`);
    });

    socket.on('unsubscribe_order', (orderId: number) => {
      socket.leave(`order-${orderId}`);
    });
  });
}
