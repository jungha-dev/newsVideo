# Vercel Deployment Fix Guide

## Issues Fixed

1. **Service Account Key File Error**: Removed file-based service account loading that was causing build failures
2. **Firebase API Key Error**: Updated all Firebase Admin initialization to use environment variables

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

1. **app/api/firebase-images/route.ts**: Updated to use environment variables only
2. **app/api/categories/route.ts**: Updated to use environment variables only
3. **app/api/video/runway/multi-generate-video/image-to-video/route.ts**: Updated to use environment variables only
4. **lib/firebase-admin.ts**: Updated to use environment variables only

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

## Security Notes

- Never commit the `serviceAccountKey.json` file to your repository
- The `keys/` directory is already in `.gitignore`
- Environment variables in Vercel are encrypted and secure
- Use different Firebase projects for development and production if possible
