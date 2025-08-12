import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

interface NewsVideoRequest {
  title: string;
  description?: string;
  prompts: string[];
  narrations: string[];
  scenes: Array<{
    scene_number: number;
    image_prompt: string;
    narration: string;
    imageUrl?: string;
  }>;
  model: string;
  aspectRatio: string;
  duration: number;
  veo3Resolution?: "720p" | "1080p";
  videoId?: string; // 기존 비디오 ID (Add Scenes 시)
  isAddScene?: boolean; // Add Scenes 플래그
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;
    const body: NewsVideoRequest = await request.json();

    console.log("API Request Body:", JSON.stringify(body, null, 2));
    const {
      title,
      description,
      prompts,
      narrations,
      scenes,
      model,
      aspectRatio,
      duration,
      veo3Resolution,
      videoId: existingVideoId,
      isAddScene,
    } = body;

    // 유효성 검사
    if (isAddScene && existingVideoId) {
      // Add Scenes 시 유효성 검사
      if (!scenes || scenes.length === 0) {
        return NextResponse.json(
          { error: "At least one scene is required" },
          { status: 400 }
        );
      }

      const scene = scenes[0];
      if (!scene.image_prompt?.trim()) {
        return NextResponse.json(
          { error: "Image prompt is required" },
          { status: 400 }
        );
      }

      if (!scene.narration?.trim()) {
        return NextResponse.json(
          { error: "Narration is required" },
          { status: 400 }
        );
      }
    } else {
      // 새로운 비디오 생성 시 유효성 검사
      if (!title?.trim()) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      if (!prompts || prompts.length === 0) {
        return NextResponse.json(
          { error: "At least one prompt is required" },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const videoId = existingVideoId || uuidv4();

    // 환경 변수 확인
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_TOKEN not configured");
      return NextResponse.json(
        { error: "Replicate API token not configured" },
        { status: 500 }
      );
    }

    if (isAddScene && existingVideoId) {
      // 기존 비디오에 Add Scenes
      const existingVideoRef = db
        .collection("users")
        .doc(uid)
        .collection("newsVideo")
        .doc(existingVideoId);
      const existingVideoDoc = await existingVideoRef.get();

      if (!existingVideoDoc.exists) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const existingVideoData = existingVideoDoc.data();
      if (!existingVideoData) {
        return NextResponse.json(
          { error: "Video data not found" },
          { status: 404 }
        );
      }
      const currentScenes = existingVideoData.scenes || [];
      const newSceneNumber = currentScenes.length + 1;

      // 새 Add Scenes
      const newScene = {
        ...scenes[0], // 첫 번째 Scene만 사용
        scene_number: newSceneNumber,
        videoUrl: "", // 비디오 생성 후 업데이트
      };

      const updatedScenes = [...currentScenes, newScene];

      // 기존 비디오 업데이트
      await existingVideoRef.update({
        scenes: updatedScenes,
        updatedAt: now,
      });

      // 새 Scene에 대해서만 비디오 생성
      const sceneVideoId = uuidv4();
      const scene = scenes[0];

      // 모델에 따른 API 호출
      let replicateResponse;
      if (model === "veo-3") {
        // Veo-3 API 호출
        replicateResponse = await fetch(
          "https://api.replicate.com/v1/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: "google/veo-3",
              input: {
                prompt: scene.image_prompt,
                resolution: veo3Resolution || "720p",
                negative_prompt: "blurry, low quality, distorted",
              },
            }),
          }
        );
      } else {
        // Kling v2 API 호출 (기본값)
        replicateResponse = await fetch(
          "https://api.replicate.com/v1/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: "kwaivgi/kling-v2.0",
              input: {
                prompt: scene.image_prompt,
                duration: existingVideoData.duration || 5,
                aspect_ratio: existingVideoData.aspectRatio || "16:9",
                cfg_scale: 0.5,
                negative_prompt: "blurry, low quality, distorted",
                ...(scene.imageUrl && { start_image: scene.imageUrl }),
              },
            }),
          }
        );
      }

      if (!replicateResponse.ok) {
        const errorText = await replicateResponse.text();
        console.error("Replicate API Error:", {
          status: replicateResponse.status,
          statusText: replicateResponse.statusText,
          error: errorText,
        });
        throw new Error(
          `Replicate API error: ${replicateResponse.status} - ${errorText}`
        );
      }

      const replicateData = await replicateResponse.json();
      console.log("Replicate API Response:", replicateData);

      // Scene 비디오 데이터 생성
      const sceneVideoData = {
        id: sceneVideoId,
        sceneIndex: currentScenes.length, // 새 Scene의 인덱스
        status: "starting" as const,
        prompt: scene.image_prompt,
        narration: scene.narration,
        replicatePredictionId: replicateData.id,
        created_at: now,
        updated_at: now,
      };

      // Firestore에 Scene 비디오 Save
      await db
        .collection("users")
        .doc(uid)
        .collection("newsVideo")
        .doc(existingVideoId)
        .collection("sceneVideos")
        .doc(sceneVideoId)
        .set(sceneVideoData);

      return NextResponse.json({
        videoId: existingVideoId,
        sceneVideos: [sceneVideoData],
        message: "Scene added successfully",
      });
    } else {
      // 새로운 Generated Video 생성
      const newsVideoData = {
        id: videoId,
        uid,
        title: title.trim(),
        description: description?.trim() || "",
        status: "processing" as const,
        prompts,
        narrations,
        scenes: scenes.map((scene, index) => ({
          ...scene,
          videoUrl: "", // 비디오 생성 후 업데이트
        })),
        model,
        aspectRatio,
        duration,
        createdAt: now,
        updatedAt: now,
      };

      // Firestore에 Save
      try {
        console.log("💾 Firestore에 비디오 데이터 저장 시작...");
        await db
          .collection("users")
          .doc(uid)
          .collection("newsVideo")
          .doc(videoId)
          .set(newsVideoData);
        console.log("✅ Firestore에 비디오 데이터 저장 완료");
      } catch (firestoreError) {
        console.error("❌ Firestore 저장 실패:", firestoreError);
        const errorMessage =
          firestoreError instanceof Error
            ? firestoreError.message
            : String(firestoreError);
        throw new Error(`Firestore save failed: ${errorMessage}`);
      }

      // 각 Scene에 대해 비디오 생성
      const videoPromises = scenes.map(async (scene, index) => {
        const sceneVideoId = uuidv4();

        // 모델에 따른 API 호출
        let replicateResponse;
        if (model === "veo-3") {
          // Veo-3 API 호출
          replicateResponse = await fetch(
            "https://api.replicate.com/v1/predictions",
            {
              method: "POST",
              headers: {
                Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                version: "google/veo-3",
                input: {
                  prompt: prompts[index],
                  resolution: veo3Resolution || "720p",
                  negative_prompt: "blurry, low quality, distorted",
                },
              }),
            }
          );
        } else {
          // Kling v2 API 호출 (기본값)
          replicateResponse = await fetch(
            "https://api.replicate.com/v1/predictions",
            {
              method: "POST",
              headers: {
                Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                version: "kwaivgi/kling-v2.0",
                input: {
                  prompt: prompts[index],
                  duration: duration,
                  aspect_ratio: aspectRatio,
                  cfg_scale: 0.5,
                  negative_prompt: "blurry, low quality, distorted",
                  ...(scene.imageUrl && { start_image: scene.imageUrl }),
                },
              }),
            }
          );
        }

        if (!replicateResponse.ok) {
          throw new Error(
            `Replicate API error: ${replicateResponse.statusText}`
          );
        }

        const replicateData = await replicateResponse.json();

        // Scene 비디오 데이터 생성
        const sceneVideoData = {
          id: sceneVideoId,
          sceneIndex: index,
          status: "starting" as const,
          prompt: prompts[index],
          narration: narrations[index],
          replicatePredictionId: replicateData.id,
          created_at: now,
          updated_at: now,
        };

        // Firestore에 Scene 비디오 Save
        await db
          .collection("users")
          .doc(uid)
          .collection("newsVideo")
          .doc(videoId)
          .collection("sceneVideos")
          .doc(sceneVideoId)
          .set(sceneVideoData);

        return sceneVideoData;
      });

      const sceneVideos = await Promise.all(videoPromises);

      return NextResponse.json({
        videoId,
        sceneVideos,
        message: `Started generating ${sceneVideos.length} scene videos`,
      });
    }
  } catch (error) {
    console.error("❌ 비디오 생성 에러:", error);

    // 에러 타입별 상세 로깅
    if (error instanceof Error) {
      console.error("에러 메시지:", error.message);
      console.error("에러 스택:", error.stack);
    }

    // 사용자에게 반환할 에러 메시지
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to generate news video",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
