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
  videoId?: string; // 기존 비디오 ID (씬 추가 시)
  isAddScene?: boolean; // 씬 추가 플래그
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
      videoId: existingVideoId,
      isAddScene,
    } = body;

    // 유효성 검사
    if (isAddScene && existingVideoId) {
      // 씬 추가 시 유효성 검사
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

    if (isAddScene && existingVideoId) {
      // 기존 비디오에 씬 추가
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

      // 새 씬 추가
      const newScene = {
        ...scenes[0], // 첫 번째 씬만 사용
        scene_number: newSceneNumber,
        videoUrl: "", // 비디오 생성 후 업데이트
      };

      const updatedScenes = [...currentScenes, newScene];

      // 기존 비디오 업데이트
      await existingVideoRef.update({
        scenes: updatedScenes,
        updatedAt: now,
      });

      // 새 씬에 대해서만 비디오 생성
      const sceneVideoId = uuidv4();
      const scene = scenes[0];

      // Replicate API 호출 (Kling v2 사용)
      const replicateResponse = await fetch(
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

      // 씬 비디오 데이터 생성
      const sceneVideoData = {
        id: sceneVideoId,
        sceneIndex: currentScenes.length, // 새 씬의 인덱스
        status: "starting" as const,
        prompt: scene.image_prompt,
        narration: scene.narration,
        replicatePredictionId: replicateData.id,
        created_at: now,
        updated_at: now,
      };

      // Firestore에 씬 비디오 저장
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
      // 새로운 뉴스 비디오 생성
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

      // Firestore에 저장
      await db
        .collection("users")
        .doc(uid)
        .collection("newsVideo")
        .doc(videoId)
        .set(newsVideoData);

      // 각 씬에 대해 비디오 생성
      const videoPromises = scenes.map(async (scene, index) => {
        const sceneVideoId = uuidv4();

        // Replicate API 호출 (Kling v2 사용)
        const replicateResponse = await fetch(
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

        if (!replicateResponse.ok) {
          throw new Error(
            `Replicate API error: ${replicateResponse.statusText}`
          );
        }

        const replicateData = await replicateResponse.json();

        // 씬 비디오 데이터 생성
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

        // Firestore에 씬 비디오 저장
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
    console.error("Error generating news video:", error);
    return NextResponse.json(
      { error: "Failed to generate news video" },
      { status: 500 }
    );
  }
}
