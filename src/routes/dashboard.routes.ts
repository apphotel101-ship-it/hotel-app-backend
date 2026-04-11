import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/authenticate';
import * as ctrl from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticateAdmin);

router.get('/admin/dashboard/overview', ctrl.getOverview);
router.get('/admin/dashboard/orders', ctrl.getOrderStats);
router.get('/admin/dashboard/feedback-stats', ctrl.getFeedbackStats);
router.get('/admin/dashboard/guest-satisfaction', ctrl.getGuestSatisfaction);

export default router;
