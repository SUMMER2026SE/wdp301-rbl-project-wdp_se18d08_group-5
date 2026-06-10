import React, { useRef, useState } from 'react';
import { validateImageFile } from '../../services/uploadService';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';

interface AvatarUploadProps {
  currentAvatar?: string;
  onSuccess?: (avatarUrl: string) => void;
  className?: string;
}

/**
 * Avatar upload component for user profile
 * Displays current avatar with option to upload new one
 */
export function AvatarUpload({ currentAvatar, className = '' }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, isLoading, error, preview } = useAvatarUpload();
  const [localError, setLocalError] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file, 5);
    if (!validation.isValid) {
      setLocalError(validation.error || 'Invalid file');
      return;
    }

    setLocalError('');
    uploadAvatar(file);
  };

  const displayAvatar = preview || currentAvatar;

  return (
    <div className={`avatar-upload ${className}`}>
      <div className="avatar-container">
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt="User avatar"
            className="avatar-image"
          />
        ) : (
          <div className="avatar-placeholder">
            <span>No Avatar</span>
          </div>
        )}
      </div>

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
        {isLoading ? 'Uploading...' : 'Change Avatar'}
      </button>

      {(error || localError) && (
        <div className="error-message">
          {error?.message || localError}
        </div>
      )}
    </div>
  );
}

export default AvatarUpload;
