import React, { useRef, useState } from 'react';
import { validateImageFile, uploadImage } from '../../services/uploadService';

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  className?: string;
  previewUrl?: string;
}

/**
 * Reusable image upload component with preview
 * Handles file validation and uploads to Cloudinary via backend
 */
export function ImageUpload({
  onImageUpload,
  onError,
  maxSizeMB = 5,
  className = '',
  previewUrl,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(previewUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file, maxSizeMB);
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid file';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsLoading(true);
    setError('');
    try {
      const response = await uploadImage(file);
      if (response.url) {
        onImageUpload(response.url);
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setPreview(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`image-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isLoading}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="upload-button"
      >
        {isLoading ? 'Uploading...' : 'Choose Image'}
      </button>

      {preview && (
        <div className="preview-container">
          <img src={preview} alt="Preview" className="preview-image" />
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default ImageUpload;
