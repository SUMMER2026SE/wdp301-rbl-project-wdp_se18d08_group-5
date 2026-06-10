# Image Upload với Cloudinary Integration

## Mục lục
1. [Tổng quan](#tổng-quan)
2. [Kiến trúc](#kiến-trúc)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Cách sử dụng](#cách-sử-dụng)
6. [Flow Diagram](#flow-diagram)
7. [Troubleshooting](#troubleshooting)

---

## Tổng quan

Hệ thống upload ảnh được thiết kế để cho phép người dùng:
- Upload avatar cho profile
- Upload ảnh cho nội dung khác
- Lưu trữ ảnh trên Cloudinary (CDN)
- Lưu URL ảnh trong MongoDB

### Công nghệ sử dụng
- **Backend**: Express.js + Multer + Cloudinary SDK
- **Frontend**: React + TypeScript + React Query
- **Database**: MongoDB (lưu URL ảnh)
- **CDN**: Cloudinary (lưu trữ và phục vụ ảnh)

---

## Kiến trúc

```
User (Frontend)
    ↓
ImageUpload Component
    ↓
uploadService.ts (validateImageFile → uploadImage/uploadAvatar)
    ↓
HTTP POST /api/v1/upload/avatar or /upload/image
    ↓
Backend Middleware (uploadSingle)
    ↓
Upload Endpoint (upload.routes.ts)
    ↓
Cloudinary API (uploadImage)
    ↓
MongoDB Update (lưu URL vào User.profile.avatar)
    ↓
Response (trả URL về client)
    ↓
Frontend (cập nhật preview + UI)
```

---

## Backend Implementation

### 1. **Cấu hình Cloudinary** (`src/config/env.ts`)

```typescript
export const ENV = {
  // ... other configs
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
} as const;
```

**Env Variables** (`backend/.env`):
```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

### 2. **Cloudinary Service** (`src/utils/cloudinary.ts`)

**Chức năng chính:**

#### `uploadImage(fileBuffer, fileName, folder)`
```typescript
export async function uploadImage(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'debate-platform/uploads'
): Promise<{ url: string; publicId: string }>
```

**Chi tiết:**
- Nhận file buffer từ Multer
- Upload đến Cloudinary với folder structure
- Cấu hình tự động: quality, format optimization
- Return secure_url và public_id
- Xử lý lỗi và stream error

#### `deleteImage(publicId)`
```typescript
export async function deleteImage(publicId: string): Promise<void>
```

**Chi tiết:**
- Xóa ảnh từ Cloudinary
- Được gọi khi user thay đổi avatar
- Dọn dẹp ảnh cũ tránh lãng phí storage

### 3. **Multer Middleware** (`src/utils/upload.ts`)

**Cấu hình:**
```typescript
const storage = multer.memoryStorage();  // Lưu file trong RAM
const fileFilter = (req, file, cb) => {
  // Chỉ chấp nhận image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files allowed'), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB max
});
```

**Export:**
```typescript
export const uploadSingle = (fieldName = 'image') => upload.single(fieldName);
export const uploadMultiple = (fieldName = 'images', maxCount = 10) => upload.array(fieldName, maxCount);
```

**Tại sao memory storage?**
- File không được lưu vào disk
- Upload trực tiếp stream lên Cloudinary
- Tiết kiệm disk space, hiệu suất tốt hơn

### 4. **Upload Routes** (`src/features/upload/upload.routes.ts`)

#### Route 1: POST `/api/v1/upload/avatar`
```typescript
router.post(
  '/avatar',
  authenticate,                    // Chỉ user login mới upload
  uploadSingle('image'),          // Middleware Multer
  asyncHandler(async (req, res) => {
    // 1. Validate file tồn tại
    if (!req.file) throw new AppError('No image', 400);
    
    // 2. Upload lên Cloudinary
    const { url, publicId } = await uploadImage(
      req.file.buffer,
      req.file.originalname,
      'debate-platform/avatars'    // Folder cho avatar
    );
    
    // 3. Xóa avatar cũ từ Cloudinary
    const user = await User.findById(req.user.userId);
    if (user?.profile.avatar) {
      const oldPublicId = extractPublicIdFromUrl(user.profile.avatar);
      if (oldPublicId) await deleteImage(oldPublicId);
    }
    
    // 4. Update MongoDB - lưu URL mới
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { 'profile.avatar': url } },
      { new: true, runValidators: true }
    );
    
    // 5. Return response
    sendSuccess(res, {
      avatar: updatedUser.profile.avatar,
      message: 'Avatar uploaded successfully'
    });
  })
);
```

**Workflow:**
1. Client gửi file multipart/form-data
2. Multer validate + parse file
3. Cloudinary upload (via stream)
4. Delete old avatar từ Cloudinary
5. Update User document trong MongoDB
6. Return URL cho client

#### Route 2: POST `/api/v1/upload/image`
```typescript
router.post(
  '/image',
  authenticate,
  uploadSingle('image'),
  asyncHandler(async (req, res) => {
    // Upload file (không xóa file cũ, không update user)
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
      message: 'Image uploaded successfully'
    });
  })
);
```

**Khác với `/avatar`:**
- Không xóa ảnh cũ
- Không update user profile
- Return `publicId` để client lưu khi cần xóa sau

#### Route 3: DELETE `/api/v1/upload/image/:publicId`
```typescript
router.delete(
  '/image/:publicId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { publicId } = req.params;
    if (!publicId) throw new AppError('Public ID required', 400);
    
    await deleteImage(publicId);
    sendSuccess(res, { message: 'Image deleted successfully' });
  })
);
```

### 5. **Helper Function**

```typescript
function extractPublicIdFromUrl(url: string): string | null {
  // URL: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{ext}
  const match = url.match(/\/upload\/(.+?)\./);
  return match ? match[1] : null;
}
```

---

## Frontend Implementation

### 1. **Upload Service** (`src/services/uploadService.ts`)

#### `validateImageFile(file, maxSizeMB)`
```typescript
export function validateImageFile(file: File, maxSizeMB: number = 5): {
  isValid: boolean;
  error?: string;
}
```

**Validation:**
- File type: JPEG, PNG, GIF, WebP
- File size: ≤ 5MB
- Return error message nếu không hợp lệ

#### `uploadAvatar(file)`
```typescript
export async function uploadAvatar(file: File): Promise<UploadResponse>
```

**Chi tiết:**
- Tạo FormData với field name 'image'
- POST đến `/upload/avatar`
- Return: `{ avatar, url, publicId, message }`

#### `uploadImage(file)`
```typescript
export async function uploadImage(file: File): Promise<UploadResponse>
```

**Chi tiết:**
- Tương tự `uploadAvatar` nhưng gọi `/upload/image`
- Return: `{ url, publicId, fileName, size, message }`

#### `deleteImage(publicId)`
```typescript
export async function deleteImage(publicId: string): Promise<{ message: string }>
```

---

### 2. **ImageUpload Component** (`src/components/common/ImageUpload.tsx`)

**Props:**
```typescript
interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;  // Callback khi upload thành công
  onError?: (error: string) => void;          // Callback khi upload lỗi
  maxSizeMB?: number;                         // Max file size (default: 5MB)
  className?: string;                         // CSS class
  previewUrl?: string;                        // URL preview ban đầu
}
```

**Chức năng:**
- Render button để chọn file
- Validate file trước upload
- Hiển thị preview (local URL)
- Upload file
- Hiển thị error message nếu có

**Code chính:**
```typescript
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  
  // 1. Validate
  const validation = validateImageFile(file, maxSizeMB);
  if (!validation.isValid) {
    setError(validation.error);
    return;
  }
  
  // 2. Create preview
  const reader = new FileReader();
  reader.onload = (e) => setPreview(e.target?.result as string);
  reader.readAsDataURL(file);
  
  // 3. Upload
  setIsLoading(true);
  try {
    const response = await uploadImage(file);
    onImageUpload(response.url);
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

---

### 3. **AvatarUpload Component** (`src/components/common/AvatarUpload.tsx`)

**Props:**
```typescript
interface AvatarUploadProps {
  currentAvatar?: string;      // URL ảnh hiện tại
  onSuccess?: (avatarUrl: string) => void;  // Callback thành công
  className?: string;
}
```

**Chức năng:**
- Hiển thị avatar hiện tại
- Nút "Change Avatar" để chọn ảnh mới
- Tích hợp hook `useAvatarUpload`
- Update query cache sau khi upload

---

### 4. **useAvatarUpload Hook** (`src/hooks/useAvatarUpload.ts`)

**Chức năng:**
```typescript
const {
  uploadAvatar,    // Function (file: File) => void
  isLoading,       // boolean
  error,           // Error | null
  preview,         // string (data URL)
  isSuccess        // boolean
} = useAvatarUpload();
```

**Chi tiết:**
- Sử dụng `useMutation` từ React Query
- Tự động invalidate queries sau upload:
  - `currentUser`
  - `userProfile`
- Error handling tích hợp

---

## Cách sử dụng

### Backend

#### 1. Bắt đầu server
```bash
cd backend
npm install cloudinary multer  # Nếu chưa install
npm run dev
```

#### 2. Kiểm tra environment variables
```bash
# File: backend/.env
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

### Frontend

#### 1. Sử dụng ImageUpload Component
```typescript
import { ImageUpload } from '@/components/common/ImageUpload';

function MyComponent() {
  const handleImageUpload = (imageUrl: string) => {
    console.log('Image uploaded:', imageUrl);
    // Lưu imageUrl vào state hoặc gửi API
  };

  return (
    <ImageUpload
      onImageUpload={handleImageUpload}
      onError={(error) => console.error(error)}
      maxSizeMB={5}
    />
  );
}
```

#### 2. Sử dụng AvatarUpload Component
```typescript
import { AvatarUpload } from '@/components/common/AvatarUpload';

function UserProfile() {
  return (
    <AvatarUpload
      currentAvatar={user?.profile.avatar}
      onSuccess={(url) => console.log('Avatar updated:', url)}
    />
  );
}
```

#### 3. Sử dụng Hook trực tiếp
```typescript
import { useAvatarUpload } from '@/hooks/useAvatarUpload';

function ProfileEditor() {
  const { uploadAvatar, isLoading, error, preview } = useAvatarUpload();

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadAvatar(file);
  };

  return (
    <>
      {preview && <img src={preview} />}
      <input type="file" onChange={handleUpload} disabled={isLoading} />
      {error && <p>{error.message}</p>}
    </>
  );
}
```

#### 4. Sử dụng Service trực tiếp
```typescript
import { uploadAvatar, uploadImage, validateImageFile } from '@/services/uploadService';

async function handleUpload(file: File) {
  // Validate
  const validation = validateImageFile(file);
  if (!validation.isValid) {
    console.error(validation.error);
    return;
  }

  // Upload
  try {
    const response = await uploadAvatar(file);
    console.log('Avatar URL:', response.avatar);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

---

## Flow Diagram

### Upload Avatar Flow
```
User clicks "Change Avatar"
         ↓
File dialog opens
         ↓
User selects image file
         ↓
Frontend validates (type, size)
         ↓
Create local preview (FileReader)
         ↓
Send POST /upload/avatar with FormData
         ↓
Backend validates file
         ↓
Multer processes (store in RAM buffer)
         ↓
Upload to Cloudinary
         ↓
Get secure_url + public_id
         ↓
Delete old avatar from Cloudinary
         ↓
Update User.profile.avatar in MongoDB
         ↓
Return new avatar URL
         ↓
Frontend receives URL
         ↓
Update component state
         ↓
Invalidate React Query cache
         ↓
UI updates with new avatar
```

### Upload General Image Flow
```
User clicks upload button
         ↓
Select image file
         ↓
Validate (frontend)
         ↓
Send POST /upload/image
         ↓
Multer + Cloudinary process
         ↓
Return URL + publicId
         ↓
Frontend stores URL (or publicId) for later use
         ↓
User can delete image later using publicId
         ↓
DELETE /upload/image/:publicId removes from Cloudinary
```

---

## Database Schema

### User Model (MongoDB)
```typescript
// Existing field
profile: {
  displayName: string;
  avatar: string;      // ← Cloudinary URL được lưu ở đây
  bio: string;
  school: string;
  club: string;
}

// Ví dụ:
// avatar: "https://res.cloudinary.com/dtzndkuo9/image/upload/v123456789/debate-platform/avatars/1718000000-user-avatar.jpg"
```

**Lợi ích của việc lưu URL:**
- Không cần lưu file binary trong MongoDB
- Có thể truy cập ảnh từ bất kỳ đâu qua HTTP
- CDN (Cloudinary) phục vụ ảnh nhanh
- Giảm kích thước database

---

## Troubleshooting

### 1. **Error: "Only image files are allowed"**
**Nguyên nhân:** File không phải image (MIME type không matching)

**Giải pháp:**
- Kiểm tra định dạng file (JPG, PNG, GIF, WebP)
- Đảm bảo client send đúng MIME type
- Server-side validation strict hơn

### 2. **Error: "File size exceeds 5MB limit"**
**Nguyên nhân:** File quá lớn

**Giải pháp:**
- Nén ảnh trước khi upload
- Frontend validation sẽ reject trước khi send
- Có thể tăng limit trong `upload.ts` nếu cần

### 3. **Cloudinary upload fails**
**Nguyên nhân:** Credentials sai hoặc network issue

**Giải pháp:**
- Kiểm tra `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong `.env`
- Test Cloudinary connection: `curl https://api.cloudinary.com/v1_1/{cloud_name}/resources/image`
- Kiểm tra network/proxy settings

### 4. **Avatar updates but doesn't display**
**Nguyên nhân:** Frontend cache không invalidate

**Giải pháp:**
- Hook `useAvatarUpload` tự động invalidate cache
- Ensure React Query configured đúng
- Force refresh browser cache: `Ctrl+Shift+Delete`

### 5. **Old avatar not deleted from Cloudinary**
**Nguyên nhân:** `extractPublicIdFromUrl` không match

**Giải pháp:**
- Log URL để debug: `console.log('Old avatar URL:', user.profile.avatar)`
- Ensure URL format matches expected pattern
- Cập nhật regex nếu Cloudinary URL format thay đổi

---

## Nextdocs / Tương lai

### Planned features:
1. **Image compression** - Client-side compression trước upload
2. **Batch upload** - Upload multiple images
3. **Image resizing** - Serve different sizes (thumb, medium, full)
4. **Drag & drop** - Improved UX
5. **Image editing** - Crop, rotate trước upload
6. **Progress bar** - Upload progress tracking
7. **Image filtering** - Add effects/filters

---

## API Quick Reference

### Upload Avatar
```http
POST /api/v1/upload/avatar
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Form field:
- image: File
```

Response:
```json
{
  "success": true,
  "data": {
    "avatar": "https://res.cloudinary.com/.../avatar.jpg",
    "message": "Avatar uploaded successfully"
  }
}
```

### Upload General Image
```http
POST /api/v1/upload/image
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Form field:
- image: File
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/.../image.jpg",
    "publicId": "debate-platform/content/...",
    "fileName": "photo.jpg",
    "size": 102400,
    "message": "Image uploaded successfully"
  }
}
```

### Delete Image
```http
DELETE /api/v1/upload/image/:publicId
Authorization: Bearer <accessToken>
```

Note: nếu `publicId` có dấu `/`, client cần encode trước khi gọi API hoặc backend cần đổi route để nhận path-safe id.

---

## Implementation Files

### Backend Created
- `backend/src/utils/cloudinary.ts`
- `backend/src/utils/upload.ts`
- `backend/src/features/upload/upload.routes.ts`

### Backend Modified
- `backend/src/config/env.ts`
- `backend/src/app.ts`
- `backend/src/types/index.ts`
- `backend/package.json`
- `backend/package-lock.json`

### Frontend Created
- `frontend/src/services/uploadService.ts`
- `frontend/src/components/common/ImageUpload.tsx`
- `frontend/src/components/common/AvatarUpload.tsx`
- `frontend/src/hooks/useAvatarUpload.ts`

---

## Summary

| Component | Mục đích | Vị trí |
|-----------|---------|--------|
| `cloudinary.ts` | Tương tác với Cloudinary API | Backend: utils |
| `upload.ts` | Multer configuration | Backend: utils |
| `upload.routes.ts` | HTTP endpoints | Backend: features |
| `uploadService.ts` | API client + validation | Frontend: services |
| `ImageUpload.tsx` | Reusable upload component | Frontend: components |
| `AvatarUpload.tsx` | Avatar-specific component | Frontend: components |
| `useAvatarUpload.ts` | Upload logic + cache management | Frontend: hooks |
| `env.ts` | Cloudinary configuration | Backend: config |
| `.env` | Cloudinary credentials | Backend root |

---

**Created:** 2026-06-10
**Version:** 1.0
**Status:** Production Ready
