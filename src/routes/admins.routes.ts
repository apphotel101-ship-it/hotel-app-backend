import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/authenticate';
import { requireRole } from '../middlewares/requireRole';
import * as ctrl from '../controllers/admins.controller';

const router = Router();

router.use(authenticateAdmin, requireRole('SUPER_ADMIN'));

router.post('/admin/admins', ctrl.createAdmin);
router.get('/admin/admins', ctrl.listAdmins);
router.patch('/admin/admins/:admin_id', ctrl.updateAdmin);
router.delete('/admin/admins/:admin_id', ctrl.deleteAdmin);

export default router;
