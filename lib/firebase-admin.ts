import { readFileSync } from "fs";
import { join } from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// 서비스 계정 정보를 가져오는 함수
const getServiceAccount = () => {
  console.log("=== Firebase Admin 초기화 ===");

  // 환경 변수에서 서비스 계정 정보를 가져오거나, 파일에서 로드
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("환경 변수에서 서비스 계정 정보 로드");
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error("❌ 환경 변수 파싱 실패:", error);
      throw new Error("FIREBASE_SERVICE_ACCOUNT 환경 변수 파싱 실패");
    }
  } else {
    console.log("파일에서 서비스 계정 정보 로드 시도");
    // 파일에서 로드 (개발 환경에서만)
    try {
      const serviceAccountPath = join(
        process.cwd(),
        "keys/serviceAccountKey.json"
      );
      console.log("서비스 계정 파일 경로:", serviceAccountPath);
      const serviceAccount = JSON.parse(
        readFileSync(serviceAccountPath, "utf-8")
      );
      console.log("✅ 서비스 계정 파일 로드 성공");
      return serviceAccount;
    } catch (error) {
      console.error("❌ 서비스 계정 파일을 찾을 수 없음");
      console.error("에러:", error);

      // 환경 변수에서 개별 필드들을 가져옴
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error(
          "Firebase 서비스 계정 키가 설정되지 않았습니다. keys/serviceAccountKey.json 파일을 생성하거나 환경변수를 설정해주세요."
        );
      }

      const serviceAccount = {
        type: process.env.FIREBASE_TYPE || "service_account",
        project_id:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nesvideo-24f56",
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: privateKey.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri:
          process.env.FIREBASE_AUTH_URI ||
          "https://accounts.google.com/o/oauth2/auth",
        token_uri:
          process.env.FIREBASE_TOKEN_URI ||
          "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL ||
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      };

      console.log("환경 변수 기반 서비스 계정:", {
        type: serviceAccount.type,
        project_id: serviceAccount.project_id,
        client_email: serviceAccount.client_email,
        has_private_key: !!serviceAccount.private_key,
      });

      return serviceAccount;
    }
  }
};

const serviceAccount = getServiceAccount();

console.log("기존 Firebase Admin 앱 수:", getApps().length);

// Storage Bucket 설정
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  "nesvideo-24f56.firebasestorage.app";
console.log("설정된 Storage Bucket:", storageBucket);

// 서비스 계정 정보 검증
if (!serviceAccount.private_key) {
  console.error("❌ 서비스 계정 private_key가 없습니다!");
  console.error("서비스 계정 정보:", {
    type: serviceAccount.type,
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email,
    has_private_key: !!serviceAccount.private_key,
  });
  throw new Error("Firebase Admin 서비스 계정 설정이 올바르지 않습니다.");
}

let app;
try {
  app =
    getApps().length === 0
      ? initializeApp({
          credential: cert(serviceAccount),
          storageBucket: storageBucket,
        })
      : getApps()[0];
} catch (error) {
  console.error("❌ Firebase Admin 초기화 실패:", error);
  throw error;
}

console.log("✅ Firebase Admin 초기화 완료");
console.log("Storage Bucket:", storageBucket);
console.log("Project ID:", serviceAccount.project_id);

export const db = getFirestore("news-video");
export const auth = getAuth(app);
export const dbAdmin = getFirestore(app);
export const storage = getStorage(app);

// Firestore 데이터베이스 정보 로깅
console.log("Firestore Database App:", app.name);
console.log("Firestore Project ID:", app.options.projectId);
