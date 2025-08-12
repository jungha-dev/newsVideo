import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { uploadReplicateVideoToFirebase } from "@/lib/utils/firebaseStorage";

export async function POST(request: NextRequest) {
  try {
    // 보안을 위한 API 키 검증 (선택사항)
    const authHeader = request.headers.get("authorization");
    const expectedKey =
      process.env.NEXT_PUBLIC_CRON_SECRET_KEY ||
      process.env.CRON_SECRET_KEY ||
      "test-secret-key-2024";

    console.log("🔐 인증 확인:", {
      authHeader: authHeader,
      expectedKey: expectedKey,
      envVar: process.env.CRON_SECRET_KEY,
      matches: authHeader === `Bearer ${expectedKey}`,
    });

    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
    }

    console.log("🕐 서버 사이드 자동 업로드 크론 작업 시작...");

    // 1. Firebase 업로드가 필요한 씬들을 찾기
    const usersSnapshot = await db.collection("users").get();
    let totalProcessed = 0;
    let totalUploaded = 0;
    let totalErrors = 0;
    let totalStatusUpdated = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`👤 사용자 ${userId} 처리 중...`);

      try {
        // 해당 사용자의 newsVideo 컬렉션 조회
        const videosSnapshot = await userDoc.ref.collection("newsVideo").get();

        for (const videoDoc of videosSnapshot.docs) {
          const videoData = videoDoc.data();
          const videoId = videoDoc.id;

          if (!videoData.scenes || !Array.isArray(videoData.scenes)) {
            continue;
          }

          console.log(
            `🎬 비디오 ${videoId} 처리 중... (${videoData.scenes.length}개 씬)`
          );

          // Firebase 업로드가 필요한 씬들 필터링 (에러가 있는 씬도 포함)
          const scenesToUpload = videoData.scenes.filter(
            (scene: any, index: number) =>
              scene.videoUrl && // Replicate에서 비디오가 생성됨
              (!scene.firebaseUrl || scene.uploadError) && // 아직 Firebase에 업로드되지 않거나 에러가 있음
              scene.videoUrl.includes("replicate") // Replicate URL인지 확인
          );

          if (scenesToUpload.length === 0) {
            console.log(`   ℹ️ 업로드할 씬이 없음`);

            // 업로드할 씬이 없지만 processing 상태인 경우 상태 확인 및 업데이트
            if (videoData.status === "processing") {
              const allScenesHaveFirebase = videoData.scenes.every(
                (scene: any) => {
                  if (scene.videoUrl) {
                    return scene.firebaseUrl;
                  }
                  return true;
                }
              );

              if (allScenesHaveFirebase) {
                console.log(
                  `   🔄 비디오 ${videoId} 상태를 'processing' → 'completed'로 강제 업데이트`
                );
                try {
                  await videoDoc.ref.update({
                    status: "completed",
                    updatedAt: new Date(),
                  });
                  totalStatusUpdated++;
                  console.log(`   ✅ 비디오 ${videoId} 상태 업데이트 완료`);
                } catch (updateError) {
                  console.error(
                    `   ❌ 비디오 ${videoId} 상태 업데이트 실패:`,
                    updateError
                  );
                }
              }
            }

            continue;
          }

          console.log(`   📤 ${scenesToUpload.length}개 씬 업로드 필요`);

          // 각 씬을 Firebase에 업로드
          const updatedScenes = [...videoData.scenes];
          let videoUpdated = false;

          for (const scene of scenesToUpload) {
            const sceneIndex = scene.scene_number - 1; // scene_number는 1부터 시작

            try {
              console.log(
                `   🔄 Scene ${scene.scene_number} Firebase 업로드 시작...`
              );

              // Firebase Storage에 업로드
              const firebaseUrl = await uploadReplicateVideoToFirebase(
                scene.videoUrl,
                userId,
                videoId,
                sceneIndex
              );

              // 씬 데이터 업데이트
              updatedScenes[sceneIndex] = {
                ...updatedScenes[sceneIndex],
                firebaseUrl: firebaseUrl,
                output: scene.videoUrl, // 원본 Replicate URL을 output에 저장
                videoUrl: firebaseUrl, // videoUrl도 Firebase URL로 업데이트
              };

              videoUpdated = true;
              totalUploaded++;

              console.log(
                `   ✅ Scene ${scene.scene_number} Firebase 업로드 완료:`,
                {
                  originalUrl: scene.videoUrl,
                  firebaseUrl: firebaseUrl,
                }
              );
            } catch (uploadError) {
              console.error(
                `   ❌ Scene ${scene.scene_number} Firebase 업로드 실패:`,
                uploadError
              );
              totalErrors++;
            }
          }

          // 비디오 문서 업데이트
          if (videoUpdated) {
            try {
              // 모든 씬이 Firebase에 업로드되었는지 확인
              const scenesWithVideo = updatedScenes.filter(
                (scene) => scene.videoUrl
              );
              const scenesWithFirebase = updatedScenes.filter(
                (scene) => scene.firebaseUrl
              );

              console.log(`   📊 씬 상태 분석:`, {
                totalScenes: updatedScenes.length,
                scenesWithVideo: scenesWithVideo.length,
                scenesWithFirebase: scenesWithFirebase.length,
                scenesNeedingUpload: scenesWithVideo.filter(
                  (scene) => !scene.firebaseUrl
                ).length,
              });

              const allScenesUploaded = updatedScenes.every((scene: any) => {
                // videoUrl이 있는 씬은 반드시 firebaseUrl도 있어야 함
                if (scene.videoUrl) {
                  return scene.firebaseUrl;
                }
                // videoUrl이 없는 씬은 무시 (아직 생성되지 않은 씬)
                return true;
              });

              // 상태 업데이트 로직
              let newStatus = videoData.status;
              console.log(`   🔍 비디오 ${videoId} 상태 업데이트 분석:`, {
                currentStatus: videoData.status,
                allScenesUploaded: allScenesUploaded,
                totalScenes: updatedScenes.length,
                scenesWithVideo: scenesWithVideo.length,
                scenesWithFirebase: scenesWithFirebase.length,
              });

              if (allScenesUploaded && videoData.status === "processing") {
                newStatus = "completed";
                console.log(
                  `   🎉 비디오 ${videoId} 상태를 'processing' → 'completed'로 업데이트`
                );
              } else if (videoData.status === "processing") {
                console.log(
                  `   ⏳ 비디오 ${videoId} 아직 처리 중 (${scenesWithFirebase.length}/${scenesWithVideo.length} 씬 완료)`
                );
              } else {
                console.log(
                  `   ℹ️ 비디오 ${videoId} 현재 상태: ${videoData.status}`
                );
              }

              await videoDoc.ref.update({
                scenes: updatedScenes,
                status: newStatus,
                updatedAt: new Date(),
              });
              console.log(
                `   📝 비디오 ${videoId} 씬 데이터 및 상태 업데이트 완료`
              );
            } catch (updateError) {
              console.error(
                `   ❌ 비디오 ${videoId} 씬 데이터 업데이트 실패:`,
                updateError
              );
            }
          }

          totalProcessed++;
        }
      } catch (userError) {
        console.error(`❌ 사용자 ${userId} 처리 중 오류:`, userError);
        totalErrors++;
      }
    }

    console.log("🎉 서버 사이드 자동 업로드 크론 작업 완료!");
    console.log("📊 처리 결과:", {
      totalProcessed,
      totalUploaded,
      totalErrors,
      totalStatusUpdated,
    });

    // 처리된 비디오 중 완료된 비디오 수 계산
    let completedVideos = 0;
    let stillProcessingVideos = 0;

    for (const userDoc of usersSnapshot.docs) {
      const videosSnapshot = await userDoc.ref.collection("newsVideo").get();
      for (const videoDoc of videosSnapshot.docs) {
        const videoData = videoDoc.data();
        if (videoData.status === "completed") {
          completedVideos++;
        } else if (videoData.status === "processing") {
          stillProcessingVideos++;
        }
      }
    }

    console.log("📈 비디오 상태 통계:", {
      completedVideos,
      stillProcessingVideos,
      totalProcessed,
      totalStatusUpdated,
    });

    return NextResponse.json({
      success: true,
      message: "Auto upload cron job completed",
      stats: {
        totalProcessed,
        totalUploaded,
        totalErrors,
        totalStatusUpdated,
      },
    });
  } catch (error) {
    console.error("❌ 서버 사이드 자동 업로드 크론 작업 실패:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET 요청도 허용 (테스트용)
export async function GET() {
  try {
    // 현재 비디오 상태 통계 수집
    const usersSnapshot = await db.collection("users").get();
    let totalVideos = 0;
    let processingVideos = 0;
    let completedVideos = 0;
    let failedVideos = 0;
    let videosWithReplicateOnly = 0;

    for (const userDoc of usersSnapshot.docs) {
      const videosSnapshot = await userDoc.ref.collection("newsVideo").get();

      for (const videoDoc of videosSnapshot.docs) {
        const videoData = videoDoc.data();
        totalVideos++;

        if (videoData.status === "processing") {
          processingVideos++;

          // processing 상태인 비디오 중 Replicate URL만 있고 Firebase URL이 없는 씬이 있는지 확인
          if (videoData.scenes && Array.isArray(videoData.scenes)) {
            const hasReplicateOnlyScenes = videoData.scenes.some(
              (scene: any) =>
                scene.videoUrl &&
                !scene.firebaseUrl &&
                scene.videoUrl.includes("replicate")
            );
            if (hasReplicateOnlyScenes) {
              videosWithReplicateOnly++;
            }
          }
        } else if (videoData.status === "completed") {
          completedVideos++;
        } else if (videoData.status === "failed") {
          failedVideos++;
        }
      }
    }

    return NextResponse.json({
      message: "Auto upload cron endpoint is running",
      timestamp: new Date().toISOString(),
      debug: {
        totalVideos,
        processingVideos,
        completedVideos,
        failedVideos,
        videosWithReplicateOnly,
        message:
          videosWithReplicateOnly > 0
            ? `${videosWithReplicateOnly}개 비디오가 자동 업로드 대상입니다.`
            : "자동 업로드할 비디오가 없습니다.",
      },
    });
  } catch (error) {
    console.error("Debug info collection failed:", error);
    return NextResponse.json(
      { error: "Failed to collect debug info" },
      { status: 500 }
    );
  }
}
