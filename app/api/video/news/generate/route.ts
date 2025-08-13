import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { uploadVideoToFirebase } from "@/lib/uploadVideoToFirebase";

// Replicate API에서 비디오 상태를 폴링하고 완료되면 Firebase에 업로드하는 함수
async function pollAndUploadVideo(
  predictionId: string,
  userId: string,
  filename: string,
  videoId: string,
  sceneIndex: number
): Promise<string> {
  console.log("🔍 pollAndUploadVideo 함수 호출됨:", {
    predictionId,
    userId,
    filename,
    videoId,
    sceneIndex,
  });

  let attempts = 0;
  const maxAttempts = 300; // 10분 타임아웃 (300초)

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.statusText}`);
      }

      const prediction = await response.json();
      console.log(
        `Prediction status (attempt ${attempts}):`,
        prediction.status
      );

      if (prediction.status === "succeeded") {
        // 비디오 생성 완료, Firebase Storage에 업로드
        const videoUrl = prediction.output as string;
        const firebaseUrl = await uploadVideoToFirebase({
          replicateUrl: videoUrl,
          userId: userId,
          videoId: videoId,
          sceneIndex: sceneIndex,
          fileName: filename,
        });
        return firebaseUrl;
      } else if (prediction.status === "failed") {
        throw new Error(
          `Video generation failed: ${prediction.error || "Unknown error"}`
        );
      }

      // 2초 대기 후 재시도
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.error(`Error polling prediction (attempt ${attempts}):`, error);
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error("Video generation timed out");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Video generation timed out");
}

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

      // 비동기로 비디오 생성 완료를 기다리고 Firebase에 업로드
      setTimeout(async () => {
        try {
          const firebaseUrl = await pollAndUploadVideo(
            replicateData.id,
            uid,
            `scene_${newSceneNumber}_${existingVideoId}`,
            existingVideoId,
            currentScenes.length
          );

          // Firestore에 Firebase URL 업데이트
          await db
            .collection("users")
            .doc(uid)
            .collection("newsVideo")
            .doc(existingVideoId)
            .collection("sceneVideos")
            .doc(sceneVideoId)
            .update({
              status: "completed",
              videoUrl: firebaseUrl,
              updated_at: new Date(),
            });

          // 메인 비디오 문서의 씬 비디오 URL도 업데이트
          const videoRef = db
            .collection("users")
            .doc(uid)
            .collection("newsVideo")
            .doc(existingVideoId);
          const videoDoc = await videoRef.get();
          if (videoDoc.exists) {
            const videoData = videoDoc.data();
            if (videoData) {
              const updatedScenes = (videoData.scenes || []).map(
                (s: any, idx: number) =>
                  idx === currentScenes.length
                    ? { ...s, videoUrl: firebaseUrl }
                    : s
              );

              await videoRef.update({
                scenes: updatedScenes,
                updatedAt: new Date(),
              });
            }
          }

          console.log(`Scene video uploaded and updated: ${firebaseUrl}`);
        } catch (error) {
          console.error("Error processing scene video:", error);

          // 에러 상태 업데이트
          await db
            .collection("users")
            .doc(uid)
            .collection("newsVideo")
            .doc(existingVideoId)
            .collection("sceneVideos")
            .doc(sceneVideoId)
            .update({
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
              updated_at: new Date(),
            });
        }
      }, 1000);

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

        // 비동기로 비디오 생성 완료를 기다리고 Firebase에 업로드
        setTimeout(async () => {
          try {
            const firebaseUrl = await pollAndUploadVideo(
              replicateData.id,
              uid,
              `scene_${index + 1}_${videoId}`,
              videoId,
              index
            );

            // Firestore에 Firebase URL 업데이트
            await db
              .collection("users")
              .doc(uid)
              .collection("newsVideo")
              .doc(videoId)
              .collection("sceneVideos")
              .doc(sceneVideoId)
              .update({
                status: "completed",
                videoUrl: firebaseUrl,
                updated_at: new Date(),
              });

            // 메인 비디오 문서의 씬 비디오 URL도 업데이트
            const videoRef = db
              .collection("users")
              .doc(uid)
              .collection("newsVideo")
              .doc(videoId);
            const videoDoc = await videoRef.get();
            if (videoDoc.exists) {
              const videoData = videoDoc.data();
              if (videoData) {
                const updatedScenes = (videoData.scenes || []).map(
                  (s: any, idx: number) =>
                    idx === index ? { ...s, videoUrl: firebaseUrl } : s
                );

                await videoRef.update({
                  scenes: updatedScenes,
                  updatedAt: new Date(),
                });
              }
            }

            console.log(`Scene video uploaded and updated: ${firebaseUrl}`);
          } catch (error) {
            console.error("Error processing scene video:", error);

            // 에러 상태 업데이트
            await db
              .collection("users")
              .doc(uid)
              .collection("newsVideo")
              .doc(videoId)
              .collection("sceneVideos")
              .doc(sceneVideoId)
              .update({
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                updated_at: new Date(),
              });
          }
        }, 1000);

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
