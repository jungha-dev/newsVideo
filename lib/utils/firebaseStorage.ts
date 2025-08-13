import { getStorage } from "firebase-admin/storage";

/**
 * Replicate URL에서 비디오를 다운로드하여 Firebase Storage에 업로드
 * @param replicateUrl Replicate에서 생성된 비디오 URL
 * @param userId 사용자 ID
 * @param videoId 비디오 ID
 * @param sceneIndex Scene 인덱스
 * @returns Firebase Storage 공개 URL
 */
export async function uploadReplicateVideoToFirebase(
  replicateUrl: string,
  userId: string,
  videoId: string,
  sceneIndex: number
): Promise<string> {
  try {
    console.log(`📥 Replicate에서 비디오 다운로드 시작: ${replicateUrl}`);

    // Replicate URL에서 비디오 다운로드
    console.log("🔗 Replicate URL 요청 중...");
    const videoResponse = await fetch(replicateUrl);
    console.log(
      "📊 응답 상태:",
      videoResponse.status,
      videoResponse.statusText
    );

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    console.log("📦 비디오 데이터 다운로드 중...");
    const videoBuffer = await videoResponse.arrayBuffer();
    console.log(`📦 비디오 버퍼 크기: ${videoBuffer.byteLength} bytes`);

    // Firebase Storage 경로 설정 (scene-1.mp4, scene-2.mp4 형태)
    const fileName = `scene-${sceneIndex + 1}.mp4`;
    const storagePath = `users/${userId}/newsVideos/${videoId}/${fileName}`;

    console.log("🔧 Firebase Storage 설정 중...");
    // Firebase Admin Storage 사용
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();
    console.log("📦 Storage Bucket:", bucket.name);

    const file = bucket.file(storagePath);
    console.log("📁 파일 경로:", storagePath);

    // Firebase Storage에 업로드
    console.log(`📤 Firebase Storage 업로드 시작: ${storagePath}`);
    console.log("📊 업로드 메타데이터 설정 중...");

    await file.save(Buffer.from(videoBuffer), {
      metadata: {
        contentType: "video/mp4",
      },
    });

    console.log("✅ 파일 업로드 완료");

    // Uniform Bucket-Level Access가 활성화되어 있으므로 서명된 URL 생성
    // 10년간 유효한 서명된 URL 생성
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // 10년
    });

    console.log(`✅ Firebase Storage 업로드 완료:`);
    console.log(`   📁 경로: ${storagePath}`);
    console.log(`   📄 파일명: ${fileName}`);
    console.log(`   🔗 Firebase 서명된 URL: ${signedUrl}`);

    return signedUrl;
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
    console.error("입력 매개변수:", {
      replicateUrl,
      userId,
      videoId,
      sceneIndex,
    });
    throw error;
  }
}

/**
 * Firebase Storage에서 파일 삭제
 * @param fileUrl Firebase Storage 파일 URL
 */
export async function deleteFirebaseFile(fileUrl: string): Promise<void> {
  try {
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();

    // URL에서 파일 경로 추출
    const url = new URL(fileUrl);
    const filePath = decodeURIComponent(
      url.pathname.split("/o/")[1]?.split("?")[0] || ""
    );

    if (filePath) {
      const fileRef = bucket.file(filePath);
      await fileRef.delete();
      console.log(`✅ Firebase Storage 파일 삭제 완료: ${filePath}`);
    }
  } catch (error) {
    console.error("Firebase Storage 파일 삭제 실패:", error);
    throw error;
  }
}
