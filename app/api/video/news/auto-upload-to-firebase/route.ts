import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";

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
    const storagePath = `users/${userId}/newsVideos/${videoId}/scene-${
      sceneIndex + 1
    }.mp4`;

    console.log(`📁 Firebase Storage 경로: ${storagePath}`);

    // Firebase Admin Storage에 업로드
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: "video/mp4",
      },
    });

    console.log("Upload completed");

    // 서명된 URL 생성 (10년간 유효)
    const [signedUrl] = await storageFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });

    console.log(`✅ Scene ${sceneIndex + 1} Firebase 업로드 완료:`, {
      originalUrl: replicateUrl,
      firebaseUrl: signedUrl,
      storagePath,
    });

    return NextResponse.json({
      success: true,
      firebaseUrl: signedUrl,
      message: "Auto upload completed successfully",
    });
  } catch (error) {
    console.error("Auto upload error:", error);
    return NextResponse.json(
      { error: "자동 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
