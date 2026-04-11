import { Router } from 'express';
import { authenticateAny } from '../middlewares/authenticate';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/auth/guest/login', ctrl.guestLogin);
router.post('/auth/admin/login', ctrl.adminLogin);
router.post('/auth/refresh', ctrl.refreshToken);
router.post('/auth/logout', ctrl.logout);
router.get('/auth/me', authenticateAny, ctrl.getMe);

export default router;
