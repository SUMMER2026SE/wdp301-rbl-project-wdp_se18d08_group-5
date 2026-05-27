import mongoose from 'mongoose';
import { ENV } from './env.js';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
}
