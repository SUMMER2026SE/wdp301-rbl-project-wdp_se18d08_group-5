import api from './api';

export interface UploadResponse {
  avatar?: string;
  url?: string;
  publicId: string;
  fileName: string;
  size: number;
  message: string;
}

/**
 * Upload avatar image for the current user
 * @param file - Image file to upload
 * @returns Promise with upload response containing avatar URL
 */
export async function uploadAvatar(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/upload/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Upload general image (not tied to avatar)
 * @param file - Image file to upload
 * @returns Promise with upload response containing image URL
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Delete image from Cloudinary
 * @param publicId - Public ID of the image to delete
 * @returns Promise with deletion confirmation
 */
export async function deleteImage(publicId: string): Promise<{ message: string }> {
  const response = await api.delete(`/upload/image/${publicId}`);
  return response.data.data;
}

/**
 * Validate image file before upload
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateImageFile(file: File, maxSizeMB: number = 5): {
  isValid: boolean;
  error?: string;
} {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPG, PNG, GIF, and WebP images are supported',
    };
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      isValid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  return { isValid: true };
}
