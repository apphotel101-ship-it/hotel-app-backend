import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { setupAdminNamespace } from './adminNamespace';
import { setupGuestNamespace } from './guestNamespace';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  setupAdminNamespace(io);
  setupGuestNamespace(io);

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
