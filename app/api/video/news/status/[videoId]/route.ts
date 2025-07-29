import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { getStorage } from "firebase-admin/storage";

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

                // Firebase Storage에 직접 업로드
                try {
                  console.log(
                    `📥 Replicate에서 비디오 다운로드 시작: ${replicateData.output}`
                  );

                  // Replicate URL에서 비디오 다운로드
                  const videoResponse = await fetch(replicateData.output);
                  if (!videoResponse.ok) {
                    throw new Error(
                      `Failed to fetch video: ${videoResponse.statusText}`
                    );
                  }

                  const videoBuffer = await videoResponse.arrayBuffer();
                  console.log(
                    `📦 비디오 버퍼 크기: ${videoBuffer.byteLength} bytes`
                  );

                  // Firebase Storage 경로 설정
                  const storagePath = `users/${
                    user.uid
                  }/newsVideo/${videoId}/scene-${
                    sceneVideo.sceneIndex + 1
                  }.mp4`;

                  // Firebase Admin Storage 사용
                  const adminStorage = getStorage();
                  const bucket = adminStorage.bucket();
                  const file = bucket.file(storagePath);

                  // Firebase Storage에 업로드
                  console.log(
                    `📤 Firebase Storage 업로드 시작: ${storagePath}`
                  );
                  await file.save(Buffer.from(videoBuffer), {
                    metadata: {
                      contentType: "video/mp4",
                    },
                  });

                  // Signed URL 생성 (makePublic 대신)
                  const [signedUrl] = await file.getSignedUrl({
                    action: "read",
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일
                  });

                  const downloadURL = signedUrl;

                  updateData.firebaseUrl = downloadURL;
                  updateData.videoUrl = downloadURL; // videoUrl도 Firebase URL로 업데이트

                  // 실시간 업로드 로깅
                  console.log(
                    `🎬 Scene ${
                      sceneVideo.sceneIndex + 1
                    } Firebase Storage 업로드 완료:`
                  );
                  console.log(`   📁 경로: ${storagePath}`);
                  console.log(`   🔗 Firebase URL: ${downloadURL}`);
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
                    `   📁 시도한 경로: users/${
                      user.uid
                    }/newsVideos/${videoId}/scene-${
                      sceneVideo.sceneIndex + 1
                    }.mp4`
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
                }

                // Replicate "succeeded" → 앱 내부 "completed"로 변경
                updateData.status = "completed";
              }

              // Firestore 업데이트
              await db
                .collection("users")
                .doc(user.uid)
                .collection("newsVideo")
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

    // 전체 비디오 상태 업데이트
    if (overallStatus !== videoData.status) {
      await db
        .collection("users")
        .doc(user.uid)
        .collection("newsVideo")
        .doc(videoId)
        .update({
          status: overallStatus,
          updatedAt: new Date(),
        });
    }

    // Scene 비디오 URL들을 메인 비디오 문서에 업데이트
    const updatedScenes = videoData.scenes.map((scene: any, index: number) => {
      const sceneVideo = updatedSceneVideos.find(
        (sv) => sv.sceneIndex === index
      );
      return {
        ...scene,
        videoUrl:
          sceneVideo?.firebaseUrl ||
          sceneVideo?.videoUrl ||
          scene.videoUrl ||
          "",
        firebaseUrl: sceneVideo?.firebaseUrl || scene.firebaseUrl || "",
      };
    });

    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
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
