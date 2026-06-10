import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadAvatar } from '../services/uploadService';

interface UploadResult {
  url: string;
  file: File;
}

/**
 * Hook for uploading user avatar
 * Automatically updates user profile after successful upload
 */
export function useAvatarUpload() {
  const [preview, setPreview] = useState<string>('');
  const queryClient = useQueryClient();

  const mutation = useMutation<UploadResult, Error, File>({
    mutationFn: async (file: File) => {
      // Create preview immediately
      return new Promise<UploadResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setPreview(result);
          // Then upload
          uploadAvatar(file)
            .then((response) => {
              resolve({
                url: response.avatar || response.url || '',
                file,
              });
            })
            .catch(reject);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      // Invalidate and refetch user data to sync with backend
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (error: Error) => {
      setPreview('');
      console.error('Avatar upload failed:', error.message);
    },
  });

  return {
    uploadAvatar: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
    preview,
    isSuccess: mutation.isSuccess,
  };
}

export default useAvatarUpload;
