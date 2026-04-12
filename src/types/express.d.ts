import { GuestPayload, AdminPayload } from './auth.types';

declare module 'express-serve-static-core' {
  interface Request {
    hotelId: number;
    guest?: GuestPayload;
    admin?: AdminPayload;
  }
}

export {};