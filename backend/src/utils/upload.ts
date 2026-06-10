import multer from 'multer';
import { AppError } from './AppError.js';

// Configure multer for memory storage (we'll upload directly to Cloudinary)
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(
      new AppError('Only image files are allowed', 400) as any,
      false
    );
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

/**
 * Middleware to handle single file upload
 * Field name should match the form-data field name from client
 */
export const uploadSingle = (fieldName: string = 'image') => {
  return upload.single(fieldName);
};

/**
 * Middleware to handle multiple file uploads
 */
export const uploadMultiple = (fieldName: string = 'images', maxCount: number = 10) => {
  return upload.array(fieldName, maxCount);
};
