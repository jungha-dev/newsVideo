import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { deleteFirebaseFile } from "@/lib/utils/firebaseStorage";

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId, scenes, deletedSceneIndex, deletedSceneNumber } =
      await request.json();

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
    let deletedScene: any = null;

    if (deletedSceneNumber !== undefined) {
      // scene_number를 기준으로 삭제된 씬 찾기
      deletedScene = videoData.scenes.find(
        (scene) => scene.scene_number === deletedSceneNumber
      );
    } else if (
      deletedSceneIndex !== undefined &&
      videoData.scenes[deletedSceneIndex]
    ) {
      // fallback: 인덱스로 찾기
      deletedScene = videoData.scenes[deletedSceneIndex];
    }

    if (deletedScene) {
      // Firebase Storage에서 비디오 파일 삭제 (여러 URL 타입 지원)
      const videoUrlsToDelete = [
        deletedScene.videoUrl,
        deletedScene.firebaseUrl,
        deletedScene.output,
      ].filter(Boolean); // undefined/null 값 제거

      for (const videoUrl of videoUrlsToDelete) {
        if (videoUrl && typeof videoUrl === "string") {
          try {
            // Firebase Storage URL인 경우
            if (videoUrl.includes("firebasestorage.googleapis.com")) {
              await deleteFirebaseFile(videoUrl);
              console.log(`✅ Deleted Firebase Storage file: ${videoUrl}`);
            }
            // Replicate URL인 경우 (선택적 삭제)
            else if (videoUrl.includes("replicate.delivery")) {
              console.log(`ℹ️ Replicate URL (not deleted): ${videoUrl}`);
            }
            // 기타 URL인 경우
            else {
              console.log(`ℹ️ Other URL type: ${videoUrl}`);
            }
          } catch (error) {
            console.error(`Error deleting video file: ${videoUrl}`, error);
            // Storage 삭제 실패해도 Firestore 업데이트는 계속 진행
          }
        }
      }
    }

    // Scene 순서 업데이트 및 완전한 데이터 정리
    const updatedScenes = scenes.map((scene: any, index: number) => {
      // 필요한 속성만 포함하여 깨끗한 씬 객체 생성
      const cleanScene = {
        scene_number: index + 1,
        image_prompt: scene.image_prompt || "",
        narration: scene.narration || "",
        imageUrl: scene.imageUrl || "",
        videoUrl: scene.videoUrl || "",
        firebaseUrl: scene.firebaseUrl || "",
        output: scene.output || "",
        // UID 정보가 있다면 제거 (깨끗한 상태 유지)
      };

      return cleanScene;
    });

    // Firestore 업데이트 - 완전한 씬 배열 교체
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
        updatedAt: new Date(),
      });

    // 삭제된 씬과 관련된 추가 데이터 정리 (예: sceneVideos 컬렉션)
    if (deletedScene) {
      try {
        // sceneVideos 컬렉션에서 해당 씬 데이터 삭제
        const sceneVideosRef = db
          .collection("users")
          .doc(user.uid)
          .collection("newsVideo")
          .doc(videoId)
          .collection("sceneVideos");

        // scene_number가 일치하는 sceneVideos 문서들 삭제
        const sceneVideosToDelete = await sceneVideosRef
          .where("sceneNumber", "==", deletedScene.scene_number)
          .get();

        const deletePromises = sceneVideosToDelete.docs.map((doc) =>
          doc.ref.delete()
        );
        await Promise.all(deletePromises);

        console.log(
          `✅ Deleted ${sceneVideosToDelete.docs.length} sceneVideos documents for scene ${deletedScene.scene_number}`
        );
      } catch (error) {
        console.error("Error deleting sceneVideos:", error);
        // sceneVideos 삭제 실패해도 메인 업데이트는 계속 진행
      }
    }

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
