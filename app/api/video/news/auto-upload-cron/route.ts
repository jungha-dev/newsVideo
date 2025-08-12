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

          // Firebase 업로드가 필요한 씬들 필터링
          const scenesToUpload = videoData.scenes.filter(
            (scene: any, index: number) =>
              scene.videoUrl && // Replicate에서 비디오가 생성됨
              !scene.firebaseUrl && // 아직 Firebase에 업로드되지 않음
              scene.videoUrl.includes("replicate") // Replicate URL인지 확인
          );

          if (scenesToUpload.length === 0) {
            console.log(`   ℹ️ 업로드할 씬이 없음`);
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
              await videoDoc.ref.update({
                scenes: updatedScenes,
                updatedAt: new Date(),
              });
              console.log(`   📝 비디오 ${videoId} 씬 데이터 업데이트 완료`);
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
    });

    return NextResponse.json({
      success: true,
      message: "Auto upload cron job completed",
      stats: {
        totalProcessed,
        totalUploaded,
        totalErrors,
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
  return NextResponse.json({
    message: "Auto upload cron endpoint is running",
    timestamp: new Date().toISOString(),
  });
}
