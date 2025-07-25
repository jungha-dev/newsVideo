import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface Hailuo02Input {
  prompt: string;
  duration?: 6 | 10;
  resolution?: "768p" | "1080p";
  prompt_optimizer?: boolean;
  first_frame_image?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Hailuo-02 Video Generation API Request Started ===");

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
      duration = 6,
      resolution = "1080p",
      prompt_optimizer = true,
      first_frame_image,
    }: Hailuo02Input = await request.json();

    console.log("=== Request Body ===");
    console.log("Prompt:", prompt);
    console.log("Duration:", duration);
    console.log("Resolution:", resolution);
    console.log("Prompt optimizer:", prompt_optimizer);
    console.log("First frame image:", first_frame_image);
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
      duration,
      resolution,
      prompt_optimizer,
    };

    // Optional parameters
    if (first_frame_image && first_frame_image.trim()) {
      input.first_frame_image = first_frame_image.trim();
    }

    console.log("=== Replicate Input Object ===");
    console.log(JSON.stringify(input, null, 2));
    console.log("=============================");

    console.log("Creating prediction with model: minimax/hailuo-02");

    const prediction = await replicate.predictions.create({
      model: "minimax/hailuo-02",
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

    return NextResponse.json({
      videoUrl: resultVideoUrl,
      taskId: finalPrediction.id,
    });
  } catch (error) {
    console.error("=== Hailuo-02 API Error ===");
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
