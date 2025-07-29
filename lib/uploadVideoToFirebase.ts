import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

    // 파일 경로 생성
    let storagePath: string;
    if (videoId && sceneIndex !== undefined) {
      // Generated Video Scene의 경우
      storagePath = `users/${userId}/newsVideos/${videoId}/scene-${
        sceneIndex + 1
      }.mp4`;
    } else if (videoId) {
      // 단일 비디오의 경우
      storagePath = `users/${userId}/videos/${videoId}/${
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

    // Firebase Storage에 업로드
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, buffer);
    console.log("Upload snapshot:", snapshot);

    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("Firebase download URL:", downloadURL);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading video to Firebase:", error);
    throw error;
  }
}
