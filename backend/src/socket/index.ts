import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ENV } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { registerRoomHandlers } from './room.socket.js';
import { registerChatHandlers } from './chat.socket.js';
import { registerDebateHandlers } from './debate.socket.js';

let io: Server;

export function getIO(): Server {
  return io;
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: ENV.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      (socket as any).userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`🔌 User connected: ${userId} [${socket.id}]`);

    // Register event handlers
    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerDebateHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${userId} [${reason}]`);
    });
  });

  console.log('📡 Socket.IO initialized');
}
