import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/authenticate';
import { requireRole } from '../middlewares/requireRole';
import * as ctrl from '../controllers/qr.controller';

const router = Router();

// Public — no auth (called before guest logs in)
router.get('/qr/resolve', ctrl.resolveQR);

// SUPER_ADMIN only
router.get('/admin/rooms/:room_id/qr/download', authenticateAdmin, requireRole('SUPER_ADMIN'), ctrl.downloadQR);
router.post('/admin/rooms/qr/generate', authenticateAdmin, requireRole('SUPER_ADMIN'), ctrl.generateQR);

export default router;
