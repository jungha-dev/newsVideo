# Vercel Deployment Fix Guide

## Issues Fixed

1. **Service Account Key File Error**: Removed file-based service account loading that was causing build failures
2. **Firebase API Key Error**: Updated all Firebase Admin initialization to use environment variables
3. **Client-side Firebase in API Routes**: Converted all API routes to use Firebase Admin SDK instead of client-side Firebase
4. **NewsVideo Module**: Updated `lib/firebase/newsVideo.ts` to use Firebase Admin SDK
5. **Build-time Firebase Initialization**: Fixed Firebase initialization during build time by using lazy initialization
6. **Client-side Firebase Admin SDK Import**: Removed Firebase Admin SDK imports from client-side components
7. **Complete Lazy Initialization**: Implemented complete lazy initialization to prevent any build-time Firebase initialization

## Required Environment Variables

You need to set the following environment variables in your Vercel project settings:

### Firebase Client Configuration (Public)

These are used for client-side Firebase operations:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Firebase Admin Configuration (Private)

These are used for server-side Firebase Admin operations:

#### Option 1: Single JSON String (Recommended)

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your_project_id","private_key_id":"your_private_key_id","private_key":"-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com","client_id":"your_client_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your_project_id.iam.gserviceaccount.com"}
```

#### Option 2: Individual Fields

```
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your_project_id.iam.gserviceaccount.com
```

### Other Required Environment Variables

```
RUNWAY_API_SECRET=your_runway_api_secret_here
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" tab
4. Click on "Environment Variables"
5. Add each variable with the appropriate value
6. Make sure to set them for "Production" environment
7. Redeploy your project

## Getting Firebase Configuration Values

### Client Configuration

1. Go to Firebase Console
2. Select your project
3. Go to Project Settings
4. Scroll down to "Your apps" section
5. Click on the web app (or create one)
6. Copy the configuration values

### Service Account Key

1. Go to Firebase Console
2. Select your project
3. Go to Project Settings
4. Go to "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file
7. Use the values from this JSON file for the environment variables

## Code Changes Made

### Updated API Routes to Use Firebase Admin SDK:

1. **app/api/firebase-images/route.ts**: Updated to use environment variables only
2. **app/api/categories/route.ts**: Updated to use environment variables only
3. **app/api/video/runway/multi-generate-video/image-to-video/route.ts**: Updated to use environment variables only
4. **lib/firebase-admin.ts**: Updated to use environment variables only and complete lazy initialization
5. **app/api/upload-from-url/route.ts**: Converted from client-side Firebase to Firebase Admin SDK
6. **app/api/upload/route.ts**: Converted from client-side Firebase to Firebase Admin SDK
7. **app/api/video/delete-batch/route.ts**: Converted from client-side Firebase to Firebase Admin SDK
8. **lib/firebase/newsVideo.ts**: Converted from client-side Firebase to Firebase Admin SDK
9. **app/api/video/news/merge-videos/route.ts**: Changed to use dynamic import for Firebase functions
10. **app/api/video/news/save/route.ts**: Created new API route for saving news videos
11. **app/(auth)/news/page.tsx**: Removed Firebase Admin SDK imports and used API calls instead
12. **lib/auth.ts**: Updated to use lazy initialization for Firebase Admin SDK

### Key Changes:

- Removed all `require("../../../keys/serviceAccountKey.json")` calls
- Removed file-based service account loading
- Added proper environment variable validation
- Converted all API routes to use Firebase Admin SDK instead of client-side Firebase
- Added proper error handling for missing environment variables
- Updated `getNewsVideoById` function to use Firebase Admin SDK
- Implemented complete lazy initialization in `lib/firebase-admin.ts` to prevent build-time Firebase initialization
- Used dynamic imports in `merge-videos` API to prevent build-time execution
- Removed Firebase Admin SDK imports from client-side components
- Created API routes for server-side Firebase operations
- Implemented function-based exports instead of instance-based exports

### Specific Changes in firebase-admin.ts:

- ❌ 모듈 레벨에서 Firebase 초기화 → ✅ 완전한 지연 초기화 (complete lazy initialization)
- ❌ `export const db = getDbInstance()` → ✅ `export const getFirebaseDb = () => getDbInstance()`
- ❌ 빌드 시점에 환경 변수 접근 → ✅ 런타임에만 환경 변수 접근
- ❌ 인스턴스 기반 export → ✅ 함수 기반 export

### Specific Changes in auth.ts:

- ❌ `import { getAuth } from "firebase-admin/auth"` → ✅ `import { getFirebaseAuth } from "./firebase-admin"`
- ❌ `getAuth().verifyIdToken(token)` → ✅ `getFirebaseAuth().verifyIdToken(token)`

### Specific Changes in newsVideo.ts:

- ❌ `import { dbAdmin } from "../firebase-admin"` → ✅ `import { getFirebaseDbAdmin } from "../firebase-admin"`
- ❌ `dbAdmin.collection(...)` → ✅ `getFirebaseDbAdmin().collection(...)`

### Specific Changes in merge-videos API:

- ❌ `import { getNewsVideoById } from "@/lib/firebase/newsVideo"` → ✅ `const { getNewsVideoById } = await import("@/lib/firebase/newsVideo")`

### Specific Changes in news page:

- ❌ `import { saveNewsVideo } from "@/lib/firebase/newsVideo"` → ✅ API 호출 사용
- ❌ `await saveNewsVideo(user.uid, newsVideoData)` → ✅ `await fetch("/api/video/news/save", ...)`

## Verification

After setting the environment variables and redeploying:

1. Check that the build succeeds
2. Test the API endpoints
3. Verify that Firebase operations work correctly
4. Check that authentication works properly

## Troubleshooting

If you still encounter issues:

1. **Build still failing**: Check that all environment variables are set correctly
2. **Firebase auth errors**: Verify that the API key and project ID are correct
3. **Service account errors**: Ensure the private key is properly formatted (with \n for line breaks)
4. **Storage errors**: Verify the storage bucket name is correct
5. **API key errors**: Make sure all API routes are using Firebase Admin SDK, not client-side Firebase
6. **Build-time errors**: Ensure Firebase initialization only happens at runtime, not build time
7. **Client-side errors**: Make sure no Firebase Admin SDK imports are in client-side components
8. **Lazy initialization errors**: Ensure all Firebase functions are called through lazy initialization functions

## Security Notes

- Never commit the `serviceAccountKey.json` file to your repository
- The `keys/` directory is already in `.gitignore`
- Environment variables in Vercel are encrypted and secure
- Use different Firebase projects for development and production if possible
- All API routes now use Firebase Admin SDK for server-side operations
- Firebase initialization is now completely lazy-loaded to prevent build-time issues
- Client-side components use API calls instead of direct Firebase Admin SDK imports
- All Firebase operations use function-based access instead of instance-based access
