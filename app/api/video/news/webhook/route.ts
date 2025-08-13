import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { uploadReplicateVideoToFirebase } from "@/lib/utils/firebaseStorage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("🔔 Replicate 웹훅 수신:", body);

    // Replicate 웹훅 데이터 구조 확인
    const { id, status, output, urls, webhook_data } = body;

    if (status !== "succeeded" || !output || !urls) {
      console.log("⚠️ 웹훅 상태가 완료되지 않음 또는 출력 데이터 없음");
      return NextResponse.json({ message: "Webhook processed" });
    }

    // webhook_data에서 videoId와 sceneIndex 추출
    const { videoId, sceneIndex, userId } = webhook_data || {};

    if (!videoId || sceneIndex === undefined || !userId) {
      console.log("❌ 필수 파라미터 누락:", { videoId, sceneIndex, userId });
      console.log("웹훅 데이터:", { webhook_data, body });
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(` Scene ${sceneIndex + 1} 자동 Firebase 업로드 시작:`, {
      videoId,
      sceneIndex,
      userId,
      replicateUrl: urls.download || output,
    });

    // Firestore 문서 참조를 먼저 생성
    const videoRef = db
      .collection("users")
      .doc(userId)
      .collection("newsVideo")
      .doc(videoId);

    try {
      // Firebase Storage에 업로드
      const firebaseUrl = await uploadReplicateVideoToFirebase(
        urls.download || output,
        userId,
        videoId,
        sceneIndex
      );

      console.log(
        `✅ Scene ${sceneIndex + 1} Firebase 업로드 완료:`,
        firebaseUrl
      );

      // Firestore 문서 업데이트
      const videoDoc = await videoRef.get();

      if (videoDoc.exists) {
        const videoData = videoDoc.data();
        if (!videoData) {
          console.error("❌ 비디오 데이터가 null입니다");
          return NextResponse.json(
            { error: "Video data is null" },
            { status: 500 }
          );
        }

        const updatedScenes = [...videoData.scenes];

        // 해당 씬 업데이트
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          firebaseUrl: firebaseUrl,
          output: urls.download || output,
          videoUrl: firebaseUrl,
        };

        // 모든 씬이 Firebase에 업로드되었는지 확인
        const allScenesUploaded = updatedScenes.every((scene: any) => {
          if (scene.videoUrl) {
            return scene.firebaseUrl;
          }
          return true;
        });

        // 상태 업데이트
        let newStatus = videoData.status;
        if (allScenesUploaded && videoData.status === "processing") {
          newStatus = "completed";
          console.log(
            `🎉 비디오 ${videoId} 상태를 'processing' → 'completed'로 업데이트`
          );
        }

        // 문서 업데이트
        await videoRef.update({
          scenes: updatedScenes,
          status: newStatus,
          updatedAt: new Date(),
        });

        console.log(`✅ 비디오 ${videoId} 문서 업데이트 완료`);
      }

      return NextResponse.json({
        success: true,
        firebaseUrl,
        message: "Webhook processed successfully",
      });
    } catch (uploadError) {
      console.error(
        `❌ Scene ${sceneIndex + 1} Firebase 업로드 실패:`,
        uploadError
      );

      // 에러 로그 저장
      try {
        const errorMessage =
          uploadError instanceof Error
            ? uploadError.message
            : String(uploadError);

        await videoRef.update({
          [`scenes.${sceneIndex}.uploadError`]: errorMessage,
          updatedAt: new Date(),
        });
      } catch (updateError) {
        console.error("❌ 에러 로그 저장 실패:", updateError);
      }

      return NextResponse.json(
        {
          error: "Upload failed",
          details:
            uploadError instanceof Error
              ? uploadError.message
              : String(uploadError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("웹훅 처리 에러:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
