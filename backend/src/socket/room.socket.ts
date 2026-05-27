import { Server, Socket } from 'socket.io';

export function registerRoomHandlers(_io: Server, socket: Socket) {
  const userId = (socket as any).userId;

  // Join a debate room
  socket.on('room:join', ({ roomId }: { roomId: string }) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    // Notify others
    socket.to(roomId).emit('room:participant-update', {
      type: 'joined',
      userId,
    });
  });

  // Leave a debate room
  socket.on('room:leave', ({ roomId }: { roomId: string }) => {
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);

    socket.to(roomId).emit('room:participant-update', {
      type: 'left',
      userId,
    });
  });
}
