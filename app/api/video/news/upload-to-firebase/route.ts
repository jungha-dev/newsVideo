import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { uploadReplicateVideoToFirebase } from "@/lib/utils/firebaseStorage";
import { db } from "@/lib/firebase-admin";
import { getVideoGeneratePath, createSafeFilename } from "@/utils/storagePaths";
import { getStorage } from "firebase-admin/storage";

export async function POST(request: NextRequest) {
  try {
    console.log("=== Firebase Storage 업로드 API 시작 ===");

    // 환경 변수 확인
    console.log("=== 환경 변수 확인 ===");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log(
      "FIREBASE_PROJECT_ID:",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );
    console.log(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
    console.log(
      "FIREBASE_SERVICE_ACCOUNT:",
      process.env.FIREBASE_SERVICE_ACCOUNT ? "설정됨" : "설정되지 않음"
    );

    // Firebase Admin 초기화 확인
    console.log("=== Firebase Admin 초기화 확인 ===");
    try {
      const adminStorage = getStorage();
      const bucket = adminStorage.bucket();
      console.log("✅ Firebase Admin Storage 초기화 확인됨");
      console.log("📦 Storage Bucket:", bucket.name);
    } catch (adminError) {
      console.error("❌ Firebase Admin 초기화 실패:", adminError);
      throw new Error(
        `Firebase Admin initialization failed: ${
          adminError instanceof Error ? adminError.message : String(adminError)
        }`
      );
    }

    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      console.error("❌ 인증 실패: 사용자 정보 없음");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, sceneIndex, replicateUrl, autoUpload = false } = body;

    console.log(`📤 Firebase Storage 업로드 시작:`);
    console.log(`   📺 비디오 ID: ${videoId}`);
    console.log(`   🎬 Scene 인덱스: ${sceneIndex}`);
    console.log(`   🔗 Replicate URL: ${replicateUrl}`);
    console.log(`   👤 사용자: ${user.uid}`);
    console.log(`   📝 요청 본문:`, body);
    console.log(`   ─────────────────────────────────────────`);

    if (!videoId || sceneIndex === undefined || !replicateUrl) {
      console.error("❌ 필수 매개변수 누락:", {
        videoId,
        sceneIndex,
        replicateUrl,
      });
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // 비디오 문서 존재 확인
    console.log("🔍 비디오 문서 확인 중...");
    const videoDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .get();

    if (!videoDoc.exists) {
      console.error(`❌ 비디오 문서를 찾을 수 없음: ${videoId}`);
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    console.log("✅ 비디오 문서 확인 완료");

    // Firebase Storage에 업로드
    console.log("📤 Firebase Storage 업로드 시작...");

    let firebaseUrl: string;

    if (autoUpload) {
      // 자동 업로드: Firebase Admin SDK 사용
      console.log("🔄 자동 업로드 모드 - Firebase Admin SDK 사용");

      try {
        // Firebase Admin Storage 초기화 확인
        console.log("🔧 Firebase Admin Storage 초기화 확인...");
        const adminStorage = getStorage();
        console.log("✅ Firebase Admin Storage 초기화 완료");

        const bucket = adminStorage.bucket();
        console.log("📦 Storage Bucket:", bucket.name);

        // URL에서 파일 다운로드
        console.log("📥 Replicate URL에서 파일 다운로드 시작...");
        const response = await fetch(replicateUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch file from URL: ${response.statusText}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`📦 다운로드된 파일 크기: ${buffer.length} bytes`);

        // Firebase Storage 경로 생성
        const storagePath = `users/${user.uid}/newsVideos/${videoId}/scene-${
          sceneIndex + 1
        }.mp4`;

        console.log(`📁 Firebase Storage 경로: ${storagePath}`);

        // Firebase Storage에 업로드
        console.log("📤 Firebase Storage에 파일 업로드 중...");
        const file = bucket.file(storagePath);

        await file.save(buffer, {
          metadata: {
            contentType: "video/mp4",
          },
        });
        console.log("✅ 파일 업로드 완료");

        // 서명된 URL 생성 (10년간 유효)
        console.log("🔗 서명된 URL 생성 중...");
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        });

        firebaseUrl = signedUrl;
        console.log(`✅ 자동 업로드 완료: ${firebaseUrl}`);
      } catch (autoUploadError) {
        console.error("❌ 자동 업로드 중 오류 발생:", autoUploadError);
        throw new Error(
          `Auto upload failed: ${
            autoUploadError instanceof Error
              ? autoUploadError.message
              : String(autoUploadError)
          }`
        );
      }
    } else {
      // 기존 방식: 유틸리티 함수 사용
      console.log("📤 기존 업로드 모드 - 유틸리티 함수 사용");
      try {
        firebaseUrl = await uploadReplicateVideoToFirebase(
          replicateUrl,
          user.uid,
          videoId,
          sceneIndex
        );
        console.log("✅ 유틸리티 함수 업로드 완료:", firebaseUrl);
      } catch (utilityError) {
        console.error("❌ 유틸리티 함수 업로드 중 오류 발생:", utilityError);
        throw new Error(
          `Utility upload failed: ${
            utilityError instanceof Error
              ? utilityError.message
              : String(utilityError)
          }`
        );
      }
    }

    console.log("✅ Firebase Storage 업로드 완료:", firebaseUrl);

    // 비디오 문서의 scenes 배열 업데이트
    console.log("📝 Firestore 업데이트 시작...");
    const videoData = videoDoc.data()!;
    const updatedScenes = [...videoData.scenes];

    if (updatedScenes[sceneIndex]) {
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        firebaseUrl: firebaseUrl,
        output: replicateUrl, // 원본 Replicate URL을 output에 저장
      };
    }

    // Firestore 업데이트
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
      });

    console.log(`✅ Firebase Storage 업로드 완료:`);
    console.log(`   🔗 Firebase URL: ${firebaseUrl}`);
    console.log(`   ─────────────────────────────────────────`);

    return NextResponse.json({
      success: true,
      firebaseUrl: firebaseUrl,
      message: `Scene ${sceneIndex + 1} uploaded to Firebase successfully`,
    });
  } catch (error) {
    console.error("=== Firebase Storage 업로드 실패 ===");
    console.error("에러 타입:", typeof error);
    console.error("에러 객체:", error);
    console.error(
      "에러 메시지:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "에러 스택:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    return NextResponse.json(
      {
        error: "Failed to upload to Firebase Storage",
        details: error instanceof Error ? error.message : String(error),
        errorType: typeof error,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
