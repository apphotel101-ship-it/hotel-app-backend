import { Router } from 'express';
import authRoutes from './auth.routes';
import roomRoutes from './rooms.routes';
import guestRoutes from './guests.routes';
import serviceRoutes from './services.routes';
import itemRoutes from './items.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './orders.routes';
import feedbackRoutes from './feedback.routes';
import notificationRoutes from './notifications.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admins.routes';
import qrRoutes from './qr.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use(authRoutes);
router.use(roomRoutes);
router.use(guestRoutes);
router.use(serviceRoutes);
router.use(itemRoutes);
router.use(cartRoutes);
router.use(orderRoutes);
router.use(feedbackRoutes);
router.use(notificationRoutes);
router.use(dashboardRoutes);
router.use(adminRoutes);
router.use(qrRoutes);
router.use(uploadRoutes);

export default router;
