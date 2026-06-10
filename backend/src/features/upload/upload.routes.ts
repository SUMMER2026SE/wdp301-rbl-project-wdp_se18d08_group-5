import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { uploadSingle } from '../../utils/upload.js';
import { uploadImage, deleteImage } from '../../utils/cloudinary.js';
import { User } from '../../models/User.js';
import { AppError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

/**
 * POST /api/v1/upload/avatar
 * Upload avatar image for authenticated user
 * Replaces previous avatar if exists
 */
router.post(
  '/avatar',
  authenticate,
  uploadSingle('image'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if file was uploaded
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Validate file size (already checked by multer, but double-check)
    if (req.file.size > 5 * 1024 * 1024) {
      throw new AppError('File size exceeds 5MB limit', 400);
    }

    try {
      // Upload to Cloudinary
      const { url } = await uploadImage(
        req.file.buffer,
        req.file.originalname,
        'debate-platform/avatars'
      );

      // Get user and delete old avatar if exists
      const user = await User.findById(req.user!.userId);
      if (user && user.profile.avatar) {
        // Extract public ID from old avatar URL and delete
        const oldPublicId = extractPublicIdFromUrl(user.profile.avatar);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }

      // Update user profile with new avatar URL
      const updatedUser = await User.findByIdAndUpdate(
        req.user!.userId,
        { $set: { 'profile.avatar': url } },
        { new: true, runValidators: true }
      );

      sendSuccess(res, {
        avatar: updatedUser?.profile.avatar,
        message: 'Avatar uploaded successfully',
      });
    } catch (error) {
      throw new AppError('Failed to upload image', 500);
    }
  })
);

/**
 * POST /api/v1/upload/image
 * Upload general image (not tied to avatar)
 * Returns the image URL for use in content
 */
router.post(
  '/image',
  authenticate,
  uploadSingle('image'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    try {
      const { url, publicId } = await uploadImage(
        req.file.buffer,
        req.file.originalname,
        'debate-platform/content'
      );

      sendSuccess(res, {
        url,
        publicId,
        fileName: req.file.originalname,
        size: req.file.size,
        message: 'Image uploaded successfully',
      });
    } catch (error) {
      throw new AppError('Failed to upload image', 500);
    }
  })
);

/**
 * DELETE /api/v1/upload/image/:publicId
 * Delete image from Cloudinary
 */
router.delete(
  '/image/:publicId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { publicId } = req.params;

    if (!publicId) {
      throw new AppError('Public ID is required', 400);
    }

    try {
      await deleteImage(publicId);
      sendSuccess(res, { message: 'Image deleted successfully' });
    } catch (error) {
      throw new AppError('Failed to delete image', 500);
    }
  })
);

/**
 * Helper function to extract public ID from Cloudinary URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{ext}
    const match = url.match(/\/upload\/(.+?)\./);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default router;
