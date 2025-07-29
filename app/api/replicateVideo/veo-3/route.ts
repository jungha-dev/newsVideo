import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { uploadVideoToFirebase } from "@/lib/uploadVideoToFirebase";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface Veo3Request {
  prompt: string;
  seed?: number;
  resolution?: "720p" | "1080p";
  negative_prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Veo-3 Video Generation API Request Started ===");

    // 환경 변수 체크
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_TOKEN is not set");
      return NextResponse.json(
        { error: "Replicate API token is not configured" },
        { status: 500 }
      );
    }

    console.log("REPLICATE_API_TOKEN is configured");

    const {
      prompt,
      seed,
      resolution = "720p",
      negative_prompt,
    }: Veo3Request = await request.json();

    console.log("=== Request Body ===");
    console.log("Prompt:", prompt);
    console.log("Seed:", seed);
    console.log("Resolution:", resolution);
    console.log("Negative prompt:", negative_prompt);
    console.log("=====================");

    if (!prompt || !prompt.trim()) {
      console.error("Validation failed: Missing prompt");
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const input: any = {
      prompt: prompt.trim(),
      resolution,
    };

    // Optional parameters
    if (seed !== undefined && seed !== null) {
      input.seed = seed;
    }

    if (negative_prompt && negative_prompt.trim()) {
      input.negative_prompt = negative_prompt.trim();
    }

    console.log("=== Replicate Input Object ===");
    console.log(JSON.stringify(input, null, 2));
    console.log("=============================");

    console.log("Creating prediction with model: google/veo-3");

    const prediction = await replicate.predictions.create({
      model: "google/veo-3",
      input,
    });

    console.log("=== Prediction Created ===");
    console.log("Prediction created:", prediction);
    console.log("Prediction ID:", prediction.id);
    console.log("Initial status:", prediction.status);
    console.log("=========================");

    // Wait for the prediction to complete
    let finalPrediction: any = prediction;
    let attempts = 0;
    const maxAttempts = 600; // 10분 타임아웃 (600초) - 비디오 생성은 더 오래 걸림

    while (
      finalPrediction.status !== "succeeded" &&
      finalPrediction.status !== "failed" &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      try {
        finalPrediction = await replicate.predictions.get(prediction.id);
        console.log(
          `Attempt ${attempts}: Prediction status: ${finalPrediction.status}`
        );

        if (finalPrediction.status === "processing") {
          console.log("Still processing...");
        } else if (finalPrediction.status === "starting") {
          console.log("Starting...");
        }
      } catch (error) {
        console.error(
          `Error fetching prediction status (attempt ${attempts}):`,
          error
        );
        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.error("Prediction timed out after 10 minutes");
      throw new Error("Video generation timed out");
    }

    if (finalPrediction.status === "failed") {
      console.error("=== Prediction Failed ===");
      console.error("Prediction ID:", finalPrediction.id);
      console.error("Status:", finalPrediction.status);
      console.error("Error:", finalPrediction.error);
      console.error("Full prediction object:", finalPrediction);
      console.error("=========================");

      const errorMessage =
        finalPrediction.error?.message ||
        finalPrediction.error ||
        "Video generation failed";
      throw new Error(`Video generation failed: ${errorMessage}`);
    }

    console.log("Final prediction:", finalPrediction);

    // Extract the output video URL
    const resultVideoUrl = finalPrediction.output as string;

    console.log("Generated video URL:", resultVideoUrl);

    // Firebase Storage에 업로드
    let firebaseUrl = resultVideoUrl;
    try {
      const { userId } = await request.json();
      if (userId) {
        firebaseUrl = await uploadVideoToFirebase({
          replicateUrl: resultVideoUrl,
          userId,
          fileName: `veo-3-${Date.now()}.mp4`,
        });
        console.log("Video uploaded to Firebase:", firebaseUrl);
      }
    } catch (uploadError) {
      console.error(
        "Failed to upload to Firebase, using Replicate URL:",
        uploadError
      );
      // Firebase 업로드 실패 시 Replicate URL 사용
    }

    return NextResponse.json({
      videoUrl: firebaseUrl,
      taskId: finalPrediction.id,
      originalUrl: resultVideoUrl, // 원본 Replicate URL도 함께 반환
    });
  } catch (error) {
    console.error("=== Veo-3 API Error ===");
    console.error("Error type:", typeof error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : error
    );
    console.error("Full error:", error);
    console.error("==========================");

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate video";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
