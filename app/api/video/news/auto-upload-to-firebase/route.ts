import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getVideoGeneratePath, createSafeFilename } from "@/utils/storagePaths";

export async function POST(request: NextRequest) {
  try {
    const { videoId, sceneIndex, replicateUrl, userId, autoUpload } =
      await request.json();

    if (!videoId || sceneIndex === undefined || !replicateUrl || !userId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // autoUpload가 true인 경우 웹훅과 동일한 로직으로 처리
    if (autoUpload) {
      console.log(`🔄 Scene ${sceneIndex + 1} 자동 업로드 모드로 실행`);
    }

    console.log(`📤 Scene ${sceneIndex + 1} 자동 Firebase 업로드 시작:`, {
      videoId,
      sceneIndex,
      replicateUrl,
      userId,
    });

    // URL에서 파일 다운로드
    const response = await fetch(replicateUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Firebase Storage 경로 생성
    const filename = createSafeFilename(
      `scene_${sceneIndex + 1}_${videoId}`,
      "replicate"
    );
    const storagePath = getVideoGeneratePath({
      userId,
      filename,
      category: "replicate",
    });

    console.log(`📁 Firebase Storage 경로: ${storagePath}`);

    // Firebase Storage에 업로드
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, buffer);
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`✅ Scene ${sceneIndex + 1} Firebase 업로드 완료:`, {
      originalUrl: replicateUrl,
      firebaseUrl: downloadURL,
      storagePath,
    });

    return NextResponse.json({
      success: true,
      firebaseUrl: downloadURL,
      storagePath,
      originalUrl: replicateUrl,
    });
  } catch (error) {
    console.error("자동 Firebase 업로드 에러:", error);
    return NextResponse.json(
      {
        error: "자동 Firebase 업로드에 실패했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
