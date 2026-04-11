import { Router } from 'express';
import { authenticateAdmin, authenticateGuest } from '../middlewares/authenticate';
import * as ctrl from '../controllers/services.controller';

const router = Router();

router.get('/services', authenticateGuest, ctrl.listServices);
router.post('/admin/services', authenticateAdmin, ctrl.createService);
router.patch('/admin/services/:service_id', authenticateAdmin, ctrl.updateService);

export default router;
