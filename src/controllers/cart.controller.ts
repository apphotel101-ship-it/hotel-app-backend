import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../socket';

type NewOrderEvent = {
  order_id: number;
  notification_id: number;
  service: string;
  created_at: Date;
};

async function getOrCreateCart(guestId: number) {
  const existing = await prisma.cart.findUnique({ where: { guestId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { guestId } });
}

// GET /api/v1/cart
export async function getCart(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const cart = await getOrCreateCart(guestId);

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: { item: true },
  });

  const total = items.reduce((sum, ci) => sum + Number(ci.item.price) * ci.quantity, 0);

  res.json({
    cart_id: cart.id,
    items: items.map((ci) => ({
      item_id: ci.itemId,
      item_name: ci.item.name,
      price: Number(ci.item.price),
      quantity: ci.quantity,
    })),
    total,
  });
}

// POST /api/v1/cart/items  (upsert — increments if already in cart)
export async function addCartItem(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const { item_id, quantity } = req.body as { item_id: number; quantity: number };

  const item = await prisma.item.findFirst({ where: { id: item_id, hotelId: req.hotelId, isAvailable: true } });
  if (!item) { res.status(404).json({ message: 'Item not found or unavailable' }); return; }

  const cart = await getOrCreateCart(guestId);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_itemId: { cartId: cart.id, itemId: item_id } },
  });

  let cartItem;
  if (existing) {
    cartItem = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    cartItem = await prisma.cartItem.create({
      data: { cartId: cart.id, itemId: item_id, quantity },
    });
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

  res.status(201).json({ cart_item_id: cartItem.id, item_id: cartItem.itemId, quantity: cartItem.quantity });
}

// PATCH /api/v1/cart/items/:item_id
export async function updateCartItem(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const itemId = parseInt(req.params.item_id as string);
  const { quantity } = req.body as { quantity: number };

  const cart = await prisma.cart.findUnique({ where: { guestId } });
  if (!cart) { res.status(404).json({ message: 'Cart not found' }); return; }

  const cartItem = await prisma.cartItem.findUnique({
    where: { cartId_itemId: { cartId: cart.id, itemId } },
  });
  if (!cartItem) { res.status(404).json({ message: 'Item not in cart' }); return; }

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: cartItem.id } });
    res.json({ item_id: itemId, quantity: 0 }); return;
  }

  const updated = await prisma.cartItem.update({ where: { id: cartItem.id }, data: { quantity } });
  res.json({ item_id: updated.itemId, quantity: updated.quantity });
}

// DELETE /api/v1/cart/items/:item_id
export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const itemId = parseInt(req.params.item_id as string);

  const cart = await prisma.cart.findUnique({ where: { guestId } });
  if (!cart) { res.status(404).json({ message: 'Cart not found' }); return; }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, itemId } });
  res.json({ message: 'Item removed' });
}

// DELETE /api/v1/cart
export async function clearCart(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const cart = await prisma.cart.findUnique({ where: { guestId } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.json({ message: 'Cart cleared' });
}

// POST /api/v1/cart/checkout
export async function checkout(req: Request, res: Response): Promise<void> {
  const guestId = req.guest!.guest_id;
  const { instructions } = req.body as { instructions?: string };
  const hotelId = req.hotelId;

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) { res.status(404).json({ message: 'Guest not found' }); return; }

  const cart = await prisma.cart.findUnique({
    where: { guestId },
    include: { items: { include: { item: { include: { service: true } } } } },
  });

  if (!cart || cart.items.length === 0) {
    res.status(400).json({ message: 'Cart is empty' }); return;
  }

  // Group by service
  const groups = new Map<number, typeof cart.items>();
  for (const ci of cart.items) {
    const sid = ci.item.serviceId;
    if (!groups.has(sid)) groups.set(sid, []);
    groups.get(sid)!.push(ci);
  }

  const createdOrders: { order_id: number; service: string; total_amount: number }[] = [];
  const eventsToEmit: NewOrderEvent[] = [];

  await prisma.$transaction(async (tx) => {
    for (const [serviceId, lineItems] of groups.entries()) {
      const service = lineItems[0].item.service;
      const totalAmount = lineItems.reduce(
        (sum, ci) => sum + Number(ci.item.price) * ci.quantity,
        0
      );

      const order = await tx.order.create({
        data: {
          hotelId,
          guestId,
          roomId: guest.roomId,
          serviceId,
          instructions,
          totalAmount,
          isBillable: service.isBillable,
          items: {
            create: lineItems.map((ci) => ({
              itemId: ci.itemId,
              nameSnapshot: ci.item.name,
              priceSnapshot: ci.item.price,
              imageSnapshot: ci.item.imageUrl,
              quantity: ci.quantity,
            })),
          },
        },
      });

      // Create notification
      const notification = await tx.notification.create({
        data: {
          hotelId,
          notificationType: 'ORDER',
          referenceId: order.id,
          referenceType: 'ORDER',
          message: `New order #${order.id} for ${service.name}`,
        },
      });

      createdOrders.push({ order_id: order.id, service: service.name, total_amount: totalAmount });
      eventsToEmit.push({
        order_id: order.id,
        notification_id: notification.id,
        service: service.name,
        created_at: order.createdAt,
      });
    }

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  });

  // Emit only after DB transaction is committed.
  for (const eventData of eventsToEmit) {
    try {
      getIO().of('/admin').emit('NEW_ORDER', {
        event: 'NEW_ORDER',
        order_id: eventData.order_id,
        notification_id: eventData.notification_id,
        service: eventData.service,
        created_at: eventData.created_at,
        alarm: true,
      });
    } catch {
      // Socket server may be unavailable during startup.
    }
  }

  res.json({ order_ids: createdOrders.map((o) => o.order_id), orders: createdOrders });
}
