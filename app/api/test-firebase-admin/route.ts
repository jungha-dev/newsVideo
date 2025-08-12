import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export async function GET() {
  try {
    console.log("=== Firebase Admin 테스트 시작 ===");

    // 환경 변수 확인
    console.log("환경 변수:");
    console.log("- NODE_ENV:", process.env.NODE_ENV);
    console.log("- FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
    console.log(
      "- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
    console.log(
      "- FIREBASE_SERVICE_ACCOUNT:",
      process.env.FIREBASE_SERVICE_ACCOUNT ? "설정됨" : "설정되지 않음"
    );

    // Firebase Admin Storage 테스트
    console.log("Firebase Admin Storage 테스트...");
    const storage = getStorage();
    const bucket = storage.bucket();
    console.log("✅ Storage Bucket:", bucket.name);

    // Firebase Admin Auth 테스트
    console.log("Firebase Admin Auth 테스트...");
    const auth = getAuth();
    console.log("✅ Auth 초기화 완료");

    // Firebase Admin Firestore 테스트
    console.log("Firebase Admin Firestore 테스트...");
    const db = getFirestore();
    console.log("✅ Firestore 초기화 완료");

    return NextResponse.json({
      success: true,
      message: "Firebase Admin 초기화 성공",
      storageBucket: bucket.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Firebase Admin 테스트 실패:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
