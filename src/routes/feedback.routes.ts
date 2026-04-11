import { Router } from 'express';
import { authenticateAdmin, authenticateGuest } from '../middlewares/authenticate';
import * as ctrl from '../controllers/feedback.controller';

const router = Router();

router.post('/feedback', authenticateGuest, ctrl.submitFeedback);
router.get('/feedback/me', authenticateGuest, ctrl.getMyFeedback);
router.get('/admin/feedback', authenticateAdmin, ctrl.listFeedback);
router.patch('/admin/feedback/:feedback_id/respond', authenticateAdmin, ctrl.respondToFeedback);

export default router;
