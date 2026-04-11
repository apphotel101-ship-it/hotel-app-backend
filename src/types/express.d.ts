import 'express';

declare global {
  namespace Express {
    interface Request {
      hotelId: number;
      guest?: {
        guest_id: number;
        room_id: number;
        hotel_id: number;
        type: 'GUEST';
      };
      admin?: {
        admin_id: number;
        hotel_id: number;
        role: 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';
        type: 'ADMIN';
      };
    }
  }
}
