import { storage } from "@/lib/firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";

/**
 * Runway MP4 URL을 Firebase Storage에 업로드하고 다운로드 URL을 반환.
 * @param videoUrl   Runway output[0] 의 .mp4 주소
 * @param taskId     동일 이름으로 저장
 * @param onProgress (0~100) 업로드 퍼센트 콜백
 */
export async function uploadVideoToFirebase(
  videoUrl: string,
  taskId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const blob = await (await fetch(videoUrl)).blob();
  const { getVideoGeneratePath, createSafeFilename } = await import(
    "./storagePaths"
  );

  const safeFilename = createSafeFilename(`${taskId}.mp4`, "video");
  const storagePath = getVideoGeneratePath({
    userId: "system", // 시스템 업로드이므로 임시 사용자 ID
    filename: safeFilename,
    category: "runway",
  });
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, blob);

  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap: UploadTaskSnapshot) => {
        if (onProgress) {
          const percent = (snap.bytesTransferred / snap.totalBytes) * 100;
          onProgress(Math.round(percent));
        }
      },
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}
