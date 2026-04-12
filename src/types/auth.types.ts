export type GuestPayload = {
  guest_id: number;
  room_id: number;
  hotel_id: number;
  type: 'GUEST';
};

export type AdminPayload = {
  admin_id: number;
  hotel_id: number;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';
  type: 'ADMIN';
};