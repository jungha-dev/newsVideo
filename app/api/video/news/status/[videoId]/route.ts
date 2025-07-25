import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await params;

    // 뉴스 비디오 정보 가져오기
    const videoDoc = await db.collection("newsVideos").doc(videoId).get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoData = videoDoc.data()!;

    // 씬 비디오들 가져오기
    const sceneVideosSnapshot = await db
      .collection("newsVideos")
      .doc(videoId)
      .collection("sceneVideos")
      .get();

    const sceneVideos = sceneVideosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string;
      status: string;
      sceneIndex: number;
      replicatePredictionId: string;
      videoUrl?: string;
      firebaseUrl?: string;
    }>;

    // 각 씬 비디오의 상태 확인 및 업데이트
    const updatedSceneVideos = await Promise.all(
      sceneVideos.map(async (sceneVideo) => {
        if (
          sceneVideo.status === "starting" ||
          sceneVideo.status === "processing"
        ) {
          try {
            // Replicate API에서 상태 확인
            const replicateResponse = await fetch(
              `https://api.replicate.com/v1/predictions/${sceneVideo.replicatePredictionId}`,
              {
                headers: {
                  Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                },
              }
            );

            if (replicateResponse.ok) {
              const replicateData = await replicateResponse.json();

              // 상태 업데이트
              const updateData: any = {
                status: replicateData.status,
                updated_at: new Date(),
              };

              // 완료된 경우 비디오 URL 저장
              if (
                replicateData.status === "succeeded" &&
                replicateData.output
              ) {
                updateData.videoUrl = replicateData.output;

                // Firebase Storage에 업로드
                try {
                  const uploadResponse = await fetch("/api/upload-from-url", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      url: replicateData.output,
                      path: `users/${user.uid}/newsVideos/${videoId}/scene-${
                        sceneVideo.sceneIndex + 1
                      }.mp4`,
                    }),
                  });

                  if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    updateData.firebaseUrl = uploadData.url;
                  }
                } catch (uploadError) {
                  console.error("Upload error:", uploadError);
                }
              }

              // Firestore 업데이트
              await db
                .collection("newsVideos")
                .doc(videoId)
                .collection("sceneVideos")
                .doc(sceneVideo.id)
                .update(updateData);

              return {
                ...sceneVideo,
                ...updateData,
              };
            }
          } catch (error) {
            console.error("Error checking scene video status:", error);
          }
        }

        return sceneVideo;
      })
    );

    // 전체 비디오 상태 확인
    const allCompleted = updatedSceneVideos.every(
      (scene) => scene.status === "succeeded"
    );
    const anyFailed = updatedSceneVideos.some(
      (scene) => scene.status === "failed"
    );

    let overallStatus = videoData.status;
    if (allCompleted) {
      overallStatus = "completed";
    } else if (anyFailed) {
      overallStatus = "failed";
    }

    // 전체 비디오 상태 업데이트
    if (overallStatus !== videoData.status) {
      await db.collection("newsVideos").doc(videoId).update({
        status: overallStatus,
        updatedAt: new Date(),
      });
    }

    // 씬 비디오 URL들을 메인 비디오 문서에 업데이트
    const updatedScenes = videoData.scenes.map((scene: any, index: number) => {
      const sceneVideo = updatedSceneVideos.find(
        (sv) => sv.sceneIndex === index
      );
      return {
        ...scene,
        videoUrl: sceneVideo?.firebaseUrl || sceneVideo?.videoUrl || "",
      };
    });

    await db.collection("newsVideos").doc(videoId).update({
      scenes: updatedScenes,
    });

    return NextResponse.json({
      video: {
        ...videoData,
        status: overallStatus,
        scenes: updatedScenes,
      },
      sceneVideos: updatedSceneVideos,
    });
  } catch (error) {
    console.error("Error checking video status:", error);
    return NextResponse.json(
      { error: "Failed to check video status" },
      { status: 500 }
    );
  }
}
