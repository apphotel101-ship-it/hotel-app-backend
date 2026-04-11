import { Router } from 'express';
import { authenticateGuest } from '../middlewares/authenticate';
import * as ctrl from '../controllers/cart.controller';

const router = Router();

router.use(authenticateGuest);

router.get('/cart', ctrl.getCart);
router.post('/cart/items', ctrl.addCartItem);
router.patch('/cart/items/:item_id', ctrl.updateCartItem);
router.delete('/cart/items/:item_id', ctrl.removeCartItem);
router.delete('/cart', ctrl.clearCart);
router.post('/cart/checkout', ctrl.checkout);

export default router;
