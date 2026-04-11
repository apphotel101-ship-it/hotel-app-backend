import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/authenticate';
import * as ctrl from '../controllers/notifications.controller';

const router = Router();

router.use(authenticateAdmin);

router.get('/admin/notifications', ctrl.listNotifications);
router.get('/admin/notifications/unread-count', ctrl.getUnreadCount);
router.patch('/admin/notifications/read-all', ctrl.markAllRead);
router.patch('/admin/notifications/:id/read', ctrl.markRead);

export default router;
