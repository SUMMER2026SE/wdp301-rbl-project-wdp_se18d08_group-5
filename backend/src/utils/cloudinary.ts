import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env.js';

// Initialize Cloudinary
cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param fileBuffer - Image file buffer
 * @param fileName - Original file name
 * @param folder - Cloudinary folder path
 * @returns Promise with Cloudinary upload result
 */
export async function uploadImage(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'debate-platform/uploads'
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: `${Date.now()}-${fileName.replace(/\s+/g, '-')}`,
        overwrite: false,
        quality: 'auto',
        fetch_format: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete image from Cloudinary
 * @param publicId - Public ID of the image to delete
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
}
