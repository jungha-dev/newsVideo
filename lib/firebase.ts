// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";

// 환경 변수 디버깅
console.log("=== 환경 변수 확인 ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log(
  "모든 환경 변수 키:",
  Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_FIREBASE")
  )
);

// 환경 변수가 없을 경우를 대비한 기본 설정
const defaultConfig = {
  apiKey: "AIzaSyB5KV-K6k5yxzU0oIbtrPjY7pMFAV5s14o",
  authDomain: "nesvideo-24f56.firebaseapp.com",
  projectId: "nesvideo-24f56",
  storageBucket: "nesvideo-24f56.firebasestorage.app",
  messagingSenderId: "840789828998",
  appId: "1:840789828998:web:eafb3eed97ff61dfb53807",
  measurementId: "G-Y070JEEY59",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    defaultConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    defaultConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    defaultConfig.measurementId,
};

// Firebase 설정 디버깅
console.log("=== Firebase 설정 확인 ===");
console.log("API Key 존재:", !!firebaseConfig.apiKey);
console.log("Auth Domain:", firebaseConfig.authDomain);
console.log("Project ID:", firebaseConfig.projectId);
console.log("Storage Bucket:", firebaseConfig.storageBucket);
console.log("Messaging Sender ID:", firebaseConfig.messagingSenderId);
console.log("App ID:", firebaseConfig.appId);

// 필수 설정 확인
const requiredConfigs = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missingConfigs = requiredConfigs.filter((config) => !process.env[config]);
if (missingConfigs.length > 0) {
  console.warn(
    "⚠️ 환경 변수가 누락되어 기본 설정을 사용합니다:",
    missingConfigs
  );
  console.warn("현재 설정된 값들:");
  requiredConfigs.forEach((config) => {
    console.warn(`${config}: ${process.env[config] ? "환경변수" : "기본값"}`);
  });
} else {
  console.log("✅ 모든 Firebase 설정이 환경 변수에서 로드되었습니다");
}

// Firebase 앱 초기화 방어 코드
console.log("기존 Firebase 앱 수:", getApps().length);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log("Firebase 앱 초기화 완료:", app.name);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Google Auth Provider 설정
provider.addScope("email");
provider.addScope("profile");

// Firebase Auth 초기화 강화
console.log("=== Firebase Auth 초기화 강화 ===");
console.log("Auth 객체 생성 완료:", auth);

// Auth 초기화 상태 확인 및 강제 초기화
const initializeAuth = async () => {
  try {
    console.log("Auth 초기화 시작...");

    // Auth가 초기화될 때까지 대기
    if ((auth as any)._initializationPromise) {
      console.log("Auth 초기화 Promise 대기 중...");
      await (auth as any)._initializationPromise;
      console.log("✅ Auth 초기화 완료");
    }

    // Persistence Manager가 준비될 때까지 대기
    if ((auth as any)._persistenceManagerAvailable) {
      console.log("Persistence Manager 대기 중...");
      await (auth as any)._persistenceManagerAvailable;
      console.log("✅ Persistence Manager 준비 완료");
    }

    console.log("Auth 초기화 상태:", (auth as any)._isInitialized);
    console.log("현재 사용자:", auth.currentUser);
  } catch (error) {
    console.error("❌ Auth 초기화 중 오류:", error);
  }
};

// Auth 초기화 실행
initializeAuth();

console.log("✅ Firebase 초기화 완료");
console.log("Auth 객체:", auth);
console.log("Provider 객체:", provider);

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
