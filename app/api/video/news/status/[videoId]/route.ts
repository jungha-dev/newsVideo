import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { uploadReplicateVideoToFirebase } from "@/lib/utils/firebaseStorage";

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

    console.log(`🔍 Generated Video 상태 확인 시작:`);
    console.log(`   📺 비디오 ID: ${videoId}`);
    console.log(`   👤 사용자: ${user.uid}`);
    console.log(`   ─────────────────────────────────────────`);

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

    // Scene 비디오들 가져오기
    const sceneVideosSnapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
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

    // 각 Scene 비디오의 상태 확인 및 업데이트
    const updatedSceneVideos = await Promise.all(
      sceneVideos.map(async (sceneVideo) => {
        if (
          sceneVideo.status === "starting" ||
          sceneVideo.status === "processing"
        ) {
          try {
            console.log(
              `🔍 Scene ${sceneVideo.sceneIndex + 1} Replicate 상태 확인:`
            );
            console.log(
              `   🆔 Prediction ID: ${sceneVideo.replicatePredictionId}`
            );
            console.log(`   📊 현재 상태: ${sceneVideo.status}`);

            // Replicate API에서 상태 확인
            const replicateResponse = await fetch(
              `https://api.replicate.com/v1/predictions/${sceneVideo.replicatePredictionId}`,
              {
                headers: {
                  Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                },
              }
            );

            console.log(
              `📡 Replicate API 응답 상태: ${replicateResponse.status} ${replicateResponse.statusText}`
            );

            if (replicateResponse.ok) {
              const replicateData = await replicateResponse.json();
              console.log(`📊 Replicate 응답 데이터:`, {
                id: replicateData.id,
                status: replicateData.status,
                output: replicateData.output,
                error: replicateData.error,
                created_at: replicateData.created_at,
                started_at: replicateData.started_at,
                completed_at: replicateData.completed_at,
              });

              // 상태 업데이트
              const updateData: any = {
                status: replicateData.status,
                updated_at: new Date(),
              };

              // 완료된 경우 비디오 URL Save
              if (
                replicateData.status === "succeeded" &&
                replicateData.output
              ) {
                console.log(
                  `✅ Scene ${sceneVideo.sceneIndex + 1} Replicate 완료!`
                );
                console.log(`   🔗 Output URL: ${replicateData.output}`);

                updateData.videoUrl = replicateData.output;

                // Firebase Storage에 직접 업로드
                try {
                  console.log(
                    `📤 Scene ${
                      sceneVideo.sceneIndex + 1
                    } Firebase Storage 업로드 시작...`
                  );
                  const downloadURL = await uploadReplicateVideoToFirebase(
                    replicateData.output,
                    user.uid,
                    videoId,
                    sceneVideo.sceneIndex
                  );

                  // output 필드에 원본 Replicate URL 저장
                  updateData.output = replicateData.output;
                  updateData.firebaseUrl = downloadURL;
                  updateData.videoUrl = downloadURL; // videoUrl도 Firebase URL로 업데이트

                  // 실시간 업로드 로깅
                  console.log(
                    `🎬 Scene ${
                      sceneVideo.sceneIndex + 1
                    } Firebase Storage 업로드 완료:`
                  );
                  console.log(
                    `   📊 원본 Replicate URL: ${replicateData.output}`
                  );
                  console.log(
                    `   ✅ 상태: ${replicateData.status} → completed`
                  );
                  console.log(`   ─────────────────────────────────────────`);
                } catch (uploadError) {
                  console.error("Upload error:", uploadError);
                  console.log(
                    `❌ Scene ${
                      sceneVideo.sceneIndex + 1
                    } Firebase Storage 업로드 실패:`
                  );
                  console.log(
                    `   🔗 원본 Replicate URL: ${replicateData.output}`
                  );
                  console.log(
                    `   ⚠️ 에러: ${
                      uploadError instanceof Error
                        ? uploadError.message
                        : String(uploadError)
                    }`
                  );
                  console.log(`   ─────────────────────────────────────────`);

                  // 실패 시 원본 Replicate URL을 그대로 유지
                  updateData.output = replicateData.output;
                  updateData.videoUrl = replicateData.output;
                  console.log(
                    `🔄 Scene ${
                      sceneVideo.sceneIndex + 1
                    } 원본 Replicate URL 유지: ${replicateData.output}`
                  );
                }

                // Replicate "succeeded" → 앱 내부 "completed"로 변경
                updateData.status = "completed";
              } else if (replicateData.status === "failed") {
                console.log(
                  `❌ Scene ${sceneVideo.sceneIndex + 1} Replicate 실패:`,
                  replicateData.error
                );
                updateData.error = replicateData.error;
              } else {
                console.log(
                  `⏳ Scene ${sceneVideo.sceneIndex + 1} 아직 처리 중: ${
                    replicateData.status
                  }`
                );
              }

              // Firestore 업데이트
              console.log(
                `📝 Scene ${sceneVideo.sceneIndex + 1} Firestore 업데이트:`,
                {
                  sceneIndex: sceneVideo.sceneIndex,
                  oldStatus: sceneVideo.status,
                  newStatus: updateData.status,
                  hasVideoUrl: !!updateData.videoUrl,
                  hasFirebaseUrl: !!updateData.firebaseUrl,
                  hasOutput: !!updateData.output,
                }
              );

              await db
                .collection("users")
                .doc(user.uid)
                .collection("newsVideo")
                .doc(videoId)
                .collection("sceneVideos")
                .doc(sceneVideo.id)
                .update(updateData);

              console.log(
                `✅ Scene ${sceneVideo.sceneIndex + 1} Firestore 업데이트 완료`
              );

              return {
                ...sceneVideo,
                ...updateData,
              };
            } else {
              console.error(
                `❌ Scene ${
                  sceneVideo.sceneIndex + 1
                } Replicate API 요청 실패:`,
                replicateResponse.status,
                replicateResponse.statusText
              );
              const errorText = await replicateResponse.text();
              console.error("에러 응답:", errorText);
            }
          } catch (error) {
            console.error(
              `❌ Scene ${sceneVideo.sceneIndex + 1} 상태 확인 중 에러:`,
              error
            );
          }
        }

        return sceneVideo;
      })
    );

    // 전체 비디오 상태 확인
    console.log("🔍 전체 비디오 상태 확인 시작...");
    console.log(
      "📊 개별 씬 상태:",
      updatedSceneVideos.map((sv) => ({
        sceneIndex: sv.sceneIndex,
        status: sv.status,
        replicateStatus: sv.replicateStatus || "unknown",
      }))
    );

    const allCompleted = updatedSceneVideos.every(
      (scene) => scene.status === "completed"
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

    console.log("📊 전체 비디오 상태 업데이트:", {
      currentStatus: videoData.status,
      newStatus: overallStatus,
      allCompleted,
      anyFailed,
      sceneCount: updatedSceneVideos.length,
      completedCount: updatedSceneVideos.filter((s) => s.status === "completed")
        .length,
      failedCount: updatedSceneVideos.filter((s) => s.status === "failed")
        .length,
      processingCount: updatedSceneVideos.filter(
        (s) => s.status === "processing"
      ).length,
      startingCount: updatedSceneVideos.filter((s) => s.status === "starting")
        .length,
    });

    // 전체 비디오 상태 업데이트
    if (overallStatus !== videoData.status) {
      console.log(
        `🔄 전체 비디오 상태 업데이트: ${videoData.status} → ${overallStatus}`
      );
      await db
        .collection("users")
        .doc(user.uid)
        .collection("newsVideo")
        .doc(videoId)
        .update({
          status: overallStatus,
          updatedAt: new Date(),
        });
      console.log("✅ 전체 비디오 상태 업데이트 완료");
    } else {
      console.log("ℹ️ 전체 비디오 상태 변경 없음");
    }

    // Scene 비디오 URL들을 메인 비디오 문서에 업데이트
    console.log("📝 메인 비디오 문서 업데이트 시작...");
    console.log(
      "🔍 현재 씬 데이터:",
      videoData.scenes.map((scene, index) => ({
        scene: index + 1,
        videoUrl: scene.videoUrl || "없음",
        firebaseUrl: scene.firebaseUrl || "없음",
        output: scene.output || "없음",
      }))
    );

    const updatedScenes = videoData.scenes.map((scene: any, index: number) => {
      const sceneVideo = updatedSceneVideos.find(
        (sv) => sv.sceneIndex === index
      );

      const updatedScene = {
        ...scene,
        videoUrl:
          sceneVideo?.firebaseUrl ||
          sceneVideo?.videoUrl ||
          scene.videoUrl ||
          "",
        firebaseUrl: sceneVideo?.firebaseUrl || scene.firebaseUrl || "",
        output: sceneVideo?.output || scene.output || "",
      };

      console.log(`Scene ${index + 1} 업데이트:`, {
        sceneIndex: index,
        hasSceneVideo: !!sceneVideo,
        sceneVideoStatus: sceneVideo?.status,
        sceneVideoFirebaseUrl: sceneVideo?.firebaseUrl,
        sceneVideoOutput: sceneVideo?.output,
        finalVideoUrl: updatedScene.videoUrl,
        finalFirebaseUrl: updatedScene.firebaseUrl,
        finalOutput: updatedScene.output,
      });

      return updatedScene;
    });

    console.log("📝 Firestore 업데이트 실행...");
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
      });

    // 디버깅: 업데이트된 씬 데이터 로깅
    console.log("🔍 업데이트된 씬 데이터:");
    updatedScenes.forEach((scene, index) => {
      console.log(`   Scene ${index + 1}:`);
      console.log(`     - firebaseUrl: ${scene.firebaseUrl || "없음"}`);
      console.log(`     - output: ${scene.output || "없음"}`);
      console.log(`     - videoUrl: ${scene.videoUrl || "없음"}`);
    });

    // 전체 완료 시 요약 로깅
    if (allCompleted) {
      console.log(`🎉 Generated Video 완료 요약:`);
      console.log(`   📺 비디오 ID: ${videoId}`);
      console.log(`   👤 사용자: ${user.uid}`);
      console.log(`   📊 총 Scene 수: ${updatedScenes.length}`);
      console.log(`   🔗 업로드된 Scene들:`);
      updatedScenes.forEach((scene, index) => {
        const sceneVideo = updatedSceneVideos.find(
          (sv) => sv.sceneIndex === index
        );
        if (sceneVideo?.firebaseUrl) {
          console.log(`      Scene ${index + 1}: ${sceneVideo.firebaseUrl}`);
        } else if (sceneVideo?.videoUrl) {
          console.log(
            `      Scene ${index + 1}: ${sceneVideo.videoUrl} (Replicate URL)`
          );
        } else {
          console.log(`      Scene ${index + 1}: 업로드되지 않음`);
        }
      });
      console.log(`   ─────────────────────────────────────────`);
    }

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
