import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ENV } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { uploadSingle } from '../../utils/upload.js';
import { uploadImage, deleteImage } from '../../utils/cloudinary.js';
import { User } from '../../models/User.js';
import { AppError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

type StoredImage = {
  url: string;
  publicId: string;
  storage: 'cloudinary' | 'local';
};

function hasCloudinaryConfig() {
  return Boolean(
    ENV.CLOUDINARY_CLOUD_NAME &&
    ENV.CLOUDINARY_API_KEY &&
    ENV.CLOUDINARY_API_SECRET,
  );
}

function getImageExtension(file: Express.Multer.File) {
  const originalExtension = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(originalExtension)) {
    return originalExtension;
  }

  const extensionByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return extensionByMime[file.mimetype] || '.jpg';
}

function getPublicUploadUrl(req: AuthRequest, relativePath: string) {
  return `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
}

async function saveImageLocally(
  req: AuthRequest,
  file: Express.Multer.File,
  folder: 'avatars' | 'content',
): Promise<StoredImage> {
  const extension = getImageExtension(file);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativePath = `${folder}/${fileName}`;
  const targetDir = path.join(UPLOAD_ROOT, folder);
  const targetPath = path.join(targetDir, fileName);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, file.buffer);

  return {
    url: getPublicUploadUrl(req, relativePath),
    publicId: relativePath,
    storage: 'local',
  };
}

async function storeImage(
  req: AuthRequest,
  file: Express.Multer.File,
  localFolder: 'avatars' | 'content',
  cloudinaryFolder: string,
): Promise<StoredImage> {
  if (hasCloudinaryConfig()) {
    try {
      const result = await uploadImage(file.buffer, file.originalname, cloudinaryFolder);
      return {
        url: result.url,
        publicId: result.publicId,
        storage: 'cloudinary',
      };
    } catch (error) {
      console.warn('Cloudinary upload failed, using local upload fallback:', error);
    }
  }

  return saveImageLocally(req, file, localFolder);
}

async function deleteLocalImageFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.pathname.startsWith('/uploads/')) return;

    const relativePath = parsedUrl.pathname.replace('/uploads/', '');
    const targetPath = path.resolve(UPLOAD_ROOT, relativePath);
    if (!targetPath.startsWith(UPLOAD_ROOT)) return;

    await fs.unlink(targetPath);
  } catch {
    // Best effort cleanup only.
  }
}

async function deleteStoredImage(url: string) {
  if (url.includes('res.cloudinary.com')) {
    const oldPublicId = extractPublicIdFromUrl(url);
    if (oldPublicId) {
      await deleteImage(oldPublicId);
    }
    return;
  }

  await deleteLocalImageFromUrl(url);
}

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
      const storedImage = await storeImage(
        req,
        req.file,
        'avatars',
        'debate-platform/avatars',
      );

      const user = await User.findById(req.user!.userId);
      if (user?.profile.avatar) {
        await deleteStoredImage(user.profile.avatar);
      }

      // Update user profile with new avatar URL
      const updatedUser = await User.findByIdAndUpdate(
        req.user!.userId,
        { $set: { 'profile.avatar': storedImage.url } },
        { new: true, runValidators: true },
      );

      sendSuccess(res, {
        avatar: updatedUser?.profile.avatar,
        url: updatedUser?.profile.avatar,
        publicId: storedImage.publicId,
        storage: storedImage.storage,
        message: 'Avatar uploaded successfully',
      });
    } catch (error) {
      console.error('Avatar upload failed:', error);
      throw new AppError('Failed to upload image', 500);
    }
  }),
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

    if (req.file.size > 5 * 1024 * 1024) {
      throw new AppError('File size exceeds 5MB limit', 400);
    }

    try {
      const storedImage = await storeImage(
        req,
        req.file,
        'content',
        'debate-platform/content',
      );

      sendSuccess(res, {
        url: storedImage.url,
        publicId: storedImage.publicId,
        storage: storedImage.storage,
        fileName: req.file.originalname,
        size: req.file.size,
        message: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new AppError('Failed to upload image', 500);
    }
  }),
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
      if (publicId.startsWith('avatars/') || publicId.startsWith('content/')) {
        await fs.unlink(path.resolve(UPLOAD_ROOT, publicId));
      } else {
        await deleteImage(publicId);
      }
      sendSuccess(res, { message: 'Image deleted successfully' });
    } catch (error) {
      throw new AppError('Failed to delete image', 500);
    }
  }),
);

/**
 * Helper function to extract public ID from Cloudinary URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{ext}
    const parsedUrl = new URL(url);
    const uploadIndex = parsedUrl.pathname.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    const uploadPath = parsedUrl.pathname.slice(uploadIndex + '/upload/'.length);
    const withoutVersion = uploadPath.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
}

export default router;
