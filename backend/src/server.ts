import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { connectDB } from './config/database.js';
import { initSocket } from './socket/index.js';
import { ENV } from './config/env.js';

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    server.listen(ENV.PORT, () => {
      console.log(`🚀 Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
      console.log(`📡 Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});
