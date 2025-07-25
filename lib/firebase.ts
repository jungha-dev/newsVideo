// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Firebase Storage URL을 올바른 형식으로 변환하는 유틸리티 함수
export const ensureFirebaseUrl = (url: string): string => {
  if (!url || typeof url !== "string") {
    console.warn("Invalid URL provided to ensureFirebaseUrl:", url);
    return url;
  }

  // Firebase Storage URL 패턴 확인
  if (url.includes("firebasestorage.googleapis.com")) {
    // 이미 ?alt=media가 포함되어 있는지 확인
    if (url.includes("?alt=media")) {
      return url;
    }

    // 기존 쿼리 파라미터가 있는지 확인
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}alt=media`;
  }

  return url;
};
