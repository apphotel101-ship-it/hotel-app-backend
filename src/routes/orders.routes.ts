import { Router } from 'express';
import { authenticateAdmin, authenticateGuest, authenticateAny } from '../middlewares/authenticate';
import * as ctrl from '../controllers/orders.controller';

const router = Router();

// Guest
router.get('/orders/active', authenticateGuest, ctrl.getActiveOrders);
router.post('/orders/:order_id/schedule', authenticateGuest, ctrl.scheduleOrder);
router.patch('/orders/:order_id/reopen', authenticateGuest, ctrl.reopenOrder);
router.patch('/orders/:order_id/guest-confirm', authenticateGuest, ctrl.guestConfirmOrder);

// Both
router.get('/orders', authenticateAny, ctrl.listOrders);
router.get('/orders/:order_id', authenticateAny, ctrl.getOrder);
router.patch('/orders/:order_id/cancel', authenticateAny, ctrl.cancelOrder);

// Admin
router.patch('/admin/orders/:order_id/status', authenticateAdmin, ctrl.updateOrderStatus);
router.patch('/admin/orders/:order_id/acknowledge', authenticateAdmin, ctrl.acknowledgeOrder);

export default router;
