import { readFileSync } from "fs";
import { join } from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// 서비스 계정 정보를 가져오는 함수
const getServiceAccount = () => {
  // 환경 변수에서 서비스 계정 정보를 가져오거나, 파일에서 로드
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // 환경 변수에서 JSON 문자열로 제공된 경우
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 파일에서 로드 (개발 환경에서만)
    try {
      const serviceAccountPath = join(
        process.cwd(),
        "keys/serviceAccountKey.json"
      );
      return JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    } catch (error) {
      console.warn(
        "Service account key file not found, using environment variables"
      );
      // 환경 변수에서 개별 필드들을 가져옴
      return {
        type: process.env.FIREBASE_TYPE || "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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
    }
  }
};

const serviceAccount = getServiceAccount();

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        storageBucket:
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
          "oing-portfolio.firebasestorage.com",
      })
    : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const dbAdmin = getFirestore(app);
export const storage = getStorage(app);
