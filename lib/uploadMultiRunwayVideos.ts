// lib/uploadRunwayVideo.ts
import { storage } from "@/lib/firebase-admin";

// Runway에서 받은 비디오 URL을 Firebase에 업로드하는 함수
export async function uploadMultiRunwayVideoToFirebase(
  videoUrl: string
): Promise<string | null> {
  try {
    console.log("🔄 Firebase 업로드 시작:", videoUrl);

    if (!videoUrl) {
      console.error("❌ 비디오 URL이 없습니다");
      return null;
    }

    // URL에서 파일 다운로드
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(
        `Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`
      );
    }

    const videoBuffer = await videoResponse.arrayBuffer();

    const taskId = `task_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Firebase Admin Storage 사용 (새로운 구조)
    const bucket = storage.bucket();
    const { getVideoGeneratePath, createSafeFilename } = await import(
      "../utils/storagePaths"
    );

    const safeFilename = createSafeFilename(`${taskId}.mp4`, "multi_video");
    const storagePath = getVideoGeneratePath({
      userId: "system", // 시스템 업로드이므로 임시 사용자 ID
      filename: safeFilename,
      category: "runway",
    });
    const file = bucket.file(storagePath);

    // 파일 업로드
    await file.save(Buffer.from(videoBuffer), {
      metadata: {
        contentType: "video/mp4",
      },
    });

    // 공개 URL 생성
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // 매우 긴 만료 시간
    });

    console.log("✅ Firebase 업로드 완료:", url);
    return url;
  } catch (err) {
    console.error("🔥 Firebase 업로드 실패:", err);
    return null;
  }
}
