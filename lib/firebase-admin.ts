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
    // 환경 변수에서 개별 필드들을 가져옴
    const serviceAccount = {
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
        process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL ||
        "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    // 필수 필드들이 모두 있는지 확인
    if (
      !serviceAccount.project_id ||
      !serviceAccount.private_key ||
      !serviceAccount.client_email
    ) {
      throw new Error(
        "Firebase service account environment variables are not properly configured"
      );
    }

    return serviceAccount;
  }
};

// 지연 초기화를 위한 함수들
let _app: any = null;
let _db: any = null;
let _auth: any = null;
let _dbAdmin: any = null;
let _storage: any = null;

const initializeAppIfNeeded = () => {
  if (!_app) {
    if (getApps().length === 0) {
      const serviceAccount = getServiceAccount();
      _app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket:
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
          "oing-portfolio.firebasestorage.com",
      });
    } else {
      _app = getApps()[0];
    }
  }
  return _app;
};

const getDbInstance = () => {
  if (!_db) {
    _db = getFirestore(initializeAppIfNeeded());
  }
  return _db;
};

const getAuthInstance = () => {
  if (!_auth) {
    _auth = getAuth(initializeAppIfNeeded());
  }
  return _auth;
};

const getDbAdminInstance = () => {
  if (!_dbAdmin) {
    _dbAdmin = getFirestore(initializeAppIfNeeded());
  }
  return _dbAdmin;
};

const getStorageInstance = () => {
  if (!_storage) {
    _storage = getStorage(initializeAppIfNeeded());
  }
  return _storage;
};

export const db = getDbInstance();
export const auth = getAuthInstance();
export const dbAdmin = getDbAdminInstance();
export const storage = getStorageInstance();
