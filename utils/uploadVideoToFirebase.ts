import { getStorage } from "firebase-admin/storage";

export interface UploadVideoOptions {
  replicateUrl: string;
  userId: string;
  videoId?: string;
  sceneIndex?: number;
  fileName?: string;
}

export async function uploadVideoToFirebase({
  replicateUrl,
  userId,
  videoId,
  sceneIndex,
  fileName,
}: UploadVideoOptions): Promise<string> {
  try {
    console.log("Starting video upload to Firebase:", {
      replicateUrl,
      userId,
      videoId,
      sceneIndex,
      fileName,
    });

    // videoId와 sceneIndex가 undefined일 때 기본값 설정
    const safeVideoId = videoId || `temp_${Date.now()}`;
    const safeSceneIndex = sceneIndex !== undefined ? sceneIndex : 0;

    // 파일 경로 생성
    let storagePath: string;
    if (safeVideoId && safeSceneIndex !== undefined) {
      // Generated Video Scene의 경우
      storagePath = `users/${userId}/newsVideos/${safeVideoId}/scene-${
        safeSceneIndex + 1
      }.mp4`;
    } else if (safeVideoId) {
      // 단일 비디오의 경우
      storagePath = `users/${userId}/videos/${safeVideoId}/${
        fileName || "video.mp4"
      }`;
    } else {
      // 기본 경로
      storagePath = `users/${userId}/videos/${Date.now()}/${
        fileName || "video.mp4"
      }`;
    }

    console.log("Storage path:", storagePath);

    // Replicate URL에서 비디오 다운로드
    const response = await fetch(replicateUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch video from Replicate: ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Video buffer size:", buffer.length, "bytes");

    // Firebase Admin Storage에 업로드
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      metadata: {
        contentType: "video/mp4",
      },
    });

    console.log("Upload completed");

    // 서명된 URL 생성 (10년간 유효)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });

    console.log("Firebase signed URL:", signedUrl);

    return signedUrl;
  } catch (error) {
    console.error("Error uploading video to Firebase:", error);
    throw error;
  }
}
