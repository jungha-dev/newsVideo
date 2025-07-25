import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId, sceneIndex, sceneData } = await request.json();

    // 뉴스 비디오 정보 가져오기
    const videoDoc = await db.collection("newsVideos").doc(videoId).get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoData = videoDoc.data()!;
    const scene = videoData.scenes[sceneIndex];

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // 기존 씬 비디오 삭제
    const existingSceneVideos = await db
      .collection("newsVideos")
      .doc(videoId)
      .collection("sceneVideos")
      .where("sceneIndex", "==", sceneIndex)
      .get();

    for (const doc of existingSceneVideos.docs) {
      await doc.ref.delete();
    }

    // 새로운 씬 비디오 생성
    const sceneVideoRef = await db
      .collection("newsVideos")
      .doc(videoId)
      .collection("sceneVideos")
      .add({
        sceneIndex: sceneIndex,
        status: "starting",
        prompt: sceneData.image_prompt,
        narration: sceneData.narration,
        imageUrl: sceneData.imageUrl || "",
        created_at: new Date(),
        updated_at: new Date(),
      });

    // Replicate API로 비디오 생성 시작
    const requestBody = {
      version: "kwaivgi/kling-v2.0",
      input: {
        prompt: sceneData.image_prompt,
        duration: 5,
        aspect_ratio: "16:9",
        cfg_scale: 0.5,
        negative_prompt: "blurry, low quality, distorted",
        ...(sceneData.imageUrl && { start_image: sceneData.imageUrl }),
        narration: sceneData.narration,
      },
    };

    console.log(
      "Replicate API request body:",
      JSON.stringify(requestBody, null, 2)
    );
    console.log(
      "REPLICATE_API_TOKEN exists:",
      !!process.env.REPLICATE_API_TOKEN
    );

    const replicateResponse = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (replicateResponse.ok) {
      const replicateData = await replicateResponse.json();
      console.log("Replicate API response:", replicateData);

      // 씬 비디오 상태 업데이트
      await sceneVideoRef.update({
        replicatePredictionId: replicateData.id,
        status: "processing",
        updated_at: new Date(),
      });

      // 메인 비디오 상태를 processing으로 변경
      await db.collection("newsVideos").doc(videoId).update({
        status: "processing",
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        predictionId: replicateData.id,
      });
    } else {
      const errorData = await replicateResponse.text();
      console.error("Replicate API error response:", errorData);
      console.error("Replicate API status:", replicateResponse.status);
      throw new Error(
        `Failed to start video generation: ${replicateResponse.status} - ${errorData}`
      );
    }
  } catch (error) {
    console.error("Error regenerating scene:", error);
    return NextResponse.json(
      { error: "Failed to regenerate scene" },
      { status: 500 }
    );
  }
}
