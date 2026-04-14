import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import prisma from '../lib/prisma';

type SubscribeAck = (response: { ok: boolean; message?: string }) => void;

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
    const guestId = socket.data.guestId as number;

    // Guest subscribes to real-time updates for a specific order
    socket.on('subscribe_order', async (orderId: number, ack?: SubscribeAck) => {
      if (!Number.isInteger(orderId) || orderId <= 0) {
        if (ack) ack({ ok: false, message: 'Invalid order id' });
        return;
      }

      try {
        const order = await prisma.order.findFirst({
          where: { id: orderId, guestId },
          select: { id: true, status: true, updatedAt: true, createdAt: true },
        });

        if (!order) {
          if (ack) ack({ ok: false, message: 'Order not found' });
          return;
        }

        socket.join(`order-${orderId}`);

        // Send immediate snapshot so reconnects do not miss current state.
        socket.emit('ORDER_SNAPSHOT', {
          event: 'ORDER_SNAPSHOT',
          order_id: order.id,
          status: order.status,
          updated_at: order.updatedAt,
          created_at: order.createdAt,
        });

        if (ack) ack({ ok: true });
      } catch {
        if (ack) ack({ ok: false, message: 'Subscription failed' });
      }
    });

    socket.on('unsubscribe_order', (orderId: number) => {
      socket.leave(`order-${orderId}`);
    });
  });
}
