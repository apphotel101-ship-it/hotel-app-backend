import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/authenticate';
import { requireRole } from '../middlewares/requireRole';
import * as ctrl from '../controllers/rooms.controller';

const router = Router();

router.use(authenticateAdmin);

router.get('/admin/rooms', ctrl.listRooms);
router.post('/admin/rooms', requireRole('SUPER_ADMIN'), ctrl.createRoom);
router.get('/admin/rooms/:room_id', ctrl.getRoom);
router.patch('/admin/rooms/:room_id', requireRole('SUPER_ADMIN'), ctrl.updateRoom);
router.delete('/admin/rooms/:room_id', requireRole('SUPER_ADMIN'), ctrl.deleteRoom);

export default router;
