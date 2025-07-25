import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    console.log("=== Interior API Request Started ===");

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
      resolution = "1080p",
      aspect_ratio = "16:9",
      reference_tags = [],
      reference_images = [],
      seed,
    } = await request.json();

    console.log("=== Request Body ===");
    console.log("Prompt:", prompt);
    console.log("Resolution:", resolution);
    console.log("Aspect ratio:", aspect_ratio);
    console.log("Reference tags:", reference_tags);
    console.log("Reference images count:", reference_images.length);
    console.log("Reference images:", reference_images);
    console.log("Seed:", seed);
    console.log("=====================");

    if (!prompt || !reference_images || reference_images.length === 0) {
      console.error("Validation failed: Missing prompt or reference_images");
      console.error("Prompt:", prompt);
      console.error("Reference images:", reference_images);
      return NextResponse.json(
        { error: "Missing prompt or reference_images" },
        { status: 400 }
      );
    }

    // Validate reference images (max 10)
    if (reference_images.length > 10) {
      console.error(
        "Validation failed: Too many reference images:",
        reference_images.length
      );
      return NextResponse.json(
        { error: "Maximum 10 reference images allowed" },
        { status: 400 }
      );
    }

    const input = {
      prompt,
      resolution,
      aspect_ratio,
      reference_tags,
      reference_images,
      ...(seed && { seed }),
    };

    console.log("=== Replicate Input Object ===");
    console.log(JSON.stringify(input, null, 2));
    console.log("=============================");

    console.log("Creating prediction with model: runwayml/gen4-image");

    const prediction = await replicate.predictions.create({
      model: "runwayml/gen4-image",
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
    const maxAttempts = 300; // 5분 타임아웃 (300초)

    while (
      finalPrediction.status !== "succeeded" &&
      finalPrediction.status !== "failed" &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
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
      console.error("Prediction timed out after 5 minutes");
      throw new Error("Image generation timed out");
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
        "Image generation failed";
      throw new Error(`Image generation failed: ${errorMessage}`);
    }

    console.log("Final prediction:", finalPrediction);

    // Extract the output URL
    const resultImageUrl = finalPrediction.output as string;

    return NextResponse.json({
      imageUrl: resultImageUrl,
      taskId: finalPrediction.id,
    });
  } catch (error) {
    console.error("=== Replicate API Error ===");
    console.error("Error type:", typeof error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : error
    );
    console.error("Full error:", error);
    console.error("==========================");

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
