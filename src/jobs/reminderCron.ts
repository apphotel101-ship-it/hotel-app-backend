import cron from 'node-cron';
import prisma from '../lib/prisma';
import { connectedAdmins, getAdminNamespace } from '../socket/adminNamespace';

// Runs every 30 minutes — pushes reminders for PLACED orders older than 5 minutes
// to admins who have reminder_enabled = true
export function startReminderCron(): void {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const hotelId = parseInt(process.env.HOTEL_ID ?? '0', 10);
      if (!hotelId) return;

      const cutoff = new Date(Date.now() - 5 * 60 * 1000); // older than 5 min

      const unacknowledgedOrders = await prisma.order.findMany({
        where: { hotelId, status: 'PLACED', createdAt: { lte: cutoff } },
        include: { room: true },
      });

      if (unacknowledgedOrders.length === 0) return;

      const adminNs = getAdminNamespace();

      for (const [socketId, adminData] of connectedAdmins.entries()) {
        if (!adminData.reminderEnabled) continue;

        for (const order of unacknowledgedOrders) {
          adminNs.to(socketId).emit('REMINDER', {
            event: 'REMINDER',
            order_id: order.id,
            room_number: order.room.roomNumber,
            pending_since: order.createdAt,
          });
        }
      }
    } catch (err) {
      console.error('Reminder cron error:', err);
    }
  });

  console.log('Reminder cron started (every 30 minutes)');
}
