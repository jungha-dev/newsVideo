import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { initializeApp, getApps, cert } from "firebase-admin/app";

// Firebase Admin 초기화 (이미 초기화되어 있지 않은 경우에만)
if (!getApps().length) {
  // 환경 변수에서 서비스 계정 정보를 가져오거나, 파일에서 로드
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // 환경 변수에서 JSON 문자열로 제공된 경우
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 환경 변수에서 개별 필드들을 가져옴
    serviceAccount = {
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
  }

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const storage = getStorage();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;

    if (!file || !path) {
      return NextResponse.json(
        { error: "파일과 경로가 필요합니다." },
        { status: 400 }
      );
    }

    // Firebase Admin Storage에 업로드
    const bucket = storage.bucket();
    const fileRef = bucket.file(path);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    // 다운로드 URL 생성
    const [downloadURL] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // 매우 긴 만료 기간
    });

    return NextResponse.json({ url: downloadURL });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
