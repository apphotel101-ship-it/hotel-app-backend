import { Router } from 'express';
import { authenticateAdmin, authenticateGuest } from '../middlewares/authenticate';
import * as ctrl from '../controllers/items.controller';

const router = Router();

// Guest endpoints
router.get('/items/search', authenticateGuest, ctrl.searchItems);
router.get('/services/:service_id/items', authenticateGuest, ctrl.listItemsByService);
router.get('/items/:item_id', authenticateGuest, ctrl.getItem);

// Admin endpoints
router.post('/admin/items', authenticateAdmin, ctrl.createItem);
router.patch('/admin/items/:item_id/availability', authenticateAdmin, ctrl.updateItemAvailability);
router.patch('/admin/items/:item_id', authenticateAdmin, ctrl.updateItem);
router.delete('/admin/items/:item_id', authenticateAdmin, ctrl.deleteItem);

export default router;
