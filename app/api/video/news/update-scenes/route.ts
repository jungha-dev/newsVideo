import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId, scenes, deletedSceneIndex } = await request.json();

    // Generated Video 정보 가져오기
    const videoDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoData = videoDoc.data()!;

    // 삭제된 Scene의 비디오 파일이 있다면 Storage에서 삭제
    if (
      deletedSceneIndex !== undefined &&
      videoData.scenes[deletedSceneIndex]
    ) {
      const deletedScene = videoData.scenes[deletedSceneIndex];

      // Firebase Storage에서 비디오 파일 삭제
      if (
        deletedScene.videoUrl &&
        deletedScene.videoUrl.includes("firebasestorage.googleapis.com")
      ) {
        try {
          // URL에서 파일 경로 추출
          const url = new URL(deletedScene.videoUrl);
          const filePath = decodeURIComponent(
            url.pathname.split("/o/")[1]?.split("?")[0] || ""
          );

          if (filePath) {
            const fileRef = storage.bucket().file(filePath);
            await fileRef.delete();
            console.log(`✅ Deleted video file from Storage: ${filePath}`);
          }
        } catch (error) {
          console.error("Error deleting video file from Storage:", error);
          // Storage 삭제 실패해도 Firestore 업데이트는 계속 진행
        }
      }
    }

    // Scene 순서 업데이트
    const updatedScenes = scenes.map((scene: any, index: number) => ({
      ...scene,
      scene_number: index + 1, // Scene 번호 재정렬
    }));

    // Firestore 업데이트
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
        updatedAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      message: "Scenes updated successfully",
    });
  } catch (error) {
    console.error("Error updating scenes:", error);
    return NextResponse.json(
      { error: "Failed to update scenes" },
      { status: 500 }
    );
  }
}
