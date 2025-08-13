# News Video Generator with Firebase Storage

This is a [Next.js](https://nextjs.org) project for generating news videos using AI models (Kling v2, Veo-3) with Firebase Storage integration.

## Firebase Storage Structure

The application uses a user-based storage structure for better organization and security:

```
/users/{userId}/
   uploads/
      images/
         categories/
            {category}/
               {filename}
         characters/
            {characterId}/
               {filename}
         video-assets/
            thumbnails/
               {filename}
         generate/
            {category}/
               {filename}
         multi-generate/
               {filename}
         connected-videos/
               {filename}
      videos/
         generate/
            {category}/
               {filename}
         multi-generate/
            {category}/
               {filename}
         connected-videos/
               {filename}
   newsVideo/
      {videoId}/
         video_1.mp4
         video_2.mp4
         ...
   avatars/
      {filename}
```

## Firestore Database Structure

The application uses a user-based Firestore structure for data organization:

```
/users/{userId}/
   connectedVideo/
      {projectId}/
         videos/
            {videoId}/
               - id: string
               - status: "starting" | "processing" | "succeeded" | "failed"
               - fromImage: string
               - toImage: string
               - index: number
               - klingPredictionId: string
               - output?: string
               - error?: string
               - created_at: timestamp
               - updated_at: timestamp
         - id: string
         - name: string
         - images: string[]
         - duration: number
         - cfg_scale: number
         - aspect_ratio: string
         - negative_prompt: string
         - created_at: timestamp
         - updated_at: timestamp
```

### Storage Path Utilities

The application includes utility functions in `utils/storagePaths.ts` for generating consistent storage paths:

- `getImageUploadPath()` - For category-based image uploads
- `getCharacterImagePath()` - For character-specific images
- `getVideoThumbnailPath()` - For video thumbnails
- `getGeneratedImagePath()` - For AI-generated images
- `getMultiGenerateImagePath()` - For multi-generation images
- `getConnectedVideoImagePath()` - For connected video images
- `getVideoGeneratePath()` - For generated videos
- `getMultiVideoGeneratePath()` - For multi-generated videos
- `getConnectedVideoPath()` - For connected videos
- `getAvatarPath()` - For user avatars

### Video Processing Features

The application includes advanced video processing features:

- **Replicate Integration**: Supports Kling v2 and Veo-3 AI models for video generation
- **Firebase Storage Upload**: Automatically uploads generated videos to Firebase Storage
- **Public Access**: Videos are made publicly accessible via `makePublic()`
- **File Naming**: Videos are named as `video_1.mp4`, `video_2.mp4`, etc.
- **Error Handling**: Falls back to original Replicate URLs if Firebase upload fails
- **Scene Management**: Supports adding, regenerating, and deleting video scenes

### Automatic Firebase Upload

The application now includes fully automatic Firebase Storage upload functionality:

- ** Fully Automatic**: No manual button clicks required - videos are automatically uploaded when ready
- **Replicate to Firebase**: Automatically uploads videos from Replicate URLs to Firebase Storage
- **Real-time Progress**: Visual feedback shows automatic upload status for each scene
- **Smart Path Management**: Uses consistent storage paths with automatic filename generation
- **Error Recovery**: Graceful handling of upload failures with automatic retry
- **Background Processing**: Uploads happen automatically in the background during video generation

## Migration

To migrate existing files to the new structure, use the migration script:

```bash
# Migrate all users
node scripts/migrate-storage.js

# Migrate specific user
node scripts/migrate-storage.js --user {userId}
```

## Features

### Connected Video Generation

The application now supports connected video generation using Kling v1.6 Pro:

1. **Multiple Image Upload**: Users can upload multiple images (minimum 2) to create a sequence of connected videos.

2. **Automatic Transition Generation**: Each pair of consecutive images generates a transition video using AI.

3. **Project Management**: Videos are organized into projects that can be saved and revisited.

4. **Real-time Status Tracking**: Users can monitor the generation progress of each video in real-time.

5. **Flexible Configuration**: Users can adjust video duration, aspect ratio, CFG scale, and negative prompts.

### Video Generation Error Handling

The application now includes improved error handling for video generation:

1. **Image Upload Persistence**: Once images are uploaded to Firebase Storage, they are cached and reused for retry attempts without re-uploading.

2. **Partial Success Support**: If some images fail during video generation, the system continues processing other images and reports partial success.

3. **Individual Image Error Handling**: Each image is processed independently, so a failure in one image doesn't stop the processing of others.

4. **Retry-Friendly Interface**: The UI maintains uploaded images when errors occur, allowing users to retry without re-uploading.

### Error Recovery Features

- **Network Error Recovery**: Temporary network issues don't require re-uploading images
- **API Error Handling**: Runway API errors are handled gracefully with detailed error messages
- **Image Size Validation**: Oversized images are skipped with clear feedback
- **Progress Tracking**: Upload status is visually indicated with checkmarks

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
