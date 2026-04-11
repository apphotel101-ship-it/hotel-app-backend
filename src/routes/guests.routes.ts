import { Router } from 'express';
import { authenticateAdmin, authenticateGuest } from '../middlewares/authenticate';
import * as ctrl from '../controllers/guests.controller';

const router = Router();

// Admin routes
router.post('/admin/guests', authenticateAdmin, ctrl.createGuest);
router.get('/admin/guests', authenticateAdmin, ctrl.listGuests);
router.get('/admin/guests/:guest_id', authenticateAdmin, ctrl.getGuest);
router.patch('/admin/guests/:guest_id', authenticateAdmin, ctrl.updateGuest);

// Guest self-service routes
router.get('/guest/me/profile', authenticateGuest, ctrl.getMyProfile);
router.get('/guest/me/history', authenticateGuest, ctrl.getMyHistory);

export default router;
