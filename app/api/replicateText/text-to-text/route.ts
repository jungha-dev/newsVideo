import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface TextToTextRequest {
  prompt: string;
  system_prompt?: string | null;
  temperature?: number;
  top_p?: number;
  max_completion_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Text-to-Text API Request Started ===");

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
      system_prompt,
      temperature = 1,
      top_p = 1,
      max_completion_tokens = 4096,
      presence_penalty = 0,
      frequency_penalty = 0,
    }: TextToTextRequest = await request.json();

    console.log("=== Request Body ===");
    console.log("Prompt:", prompt);
    console.log("System prompt:", system_prompt);
    console.log("Temperature:", temperature);
    console.log("Top P:", top_p);
    console.log("Max completion tokens:", max_completion_tokens);
    console.log("Presence penalty:", presence_penalty);
    console.log("Frequency penalty:", frequency_penalty);
    console.log("=====================");

    if (!prompt || !prompt.trim()) {
      console.error("Validation failed: Missing prompt");
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // 입력 검증
    if (temperature < 0 || temperature > 2) {
      return NextResponse.json(
        { error: "Temperature must be between 0 and 2" },
        { status: 400 }
      );
    }

    if (top_p < 0 || top_p > 1) {
      return NextResponse.json(
        { error: "Top P must be between 0 and 1" },
        { status: 400 }
      );
    }

    if (max_completion_tokens < 1 || max_completion_tokens > 8192) {
      return NextResponse.json(
        { error: "Max completion tokens must be between 1 and 8192" },
        { status: 400 }
      );
    }

    if (presence_penalty < -2 || presence_penalty > 2) {
      return NextResponse.json(
        { error: "Presence penalty must be between -2 and 2" },
        { status: 400 }
      );
    }

    if (frequency_penalty < -2 || frequency_penalty > 2) {
      return NextResponse.json(
        { error: "Frequency penalty must be between -2 and 2" },
        { status: 400 }
      );
    }

    const input = {
      prompt: prompt.trim(),
      ...(system_prompt && { system_prompt: system_prompt.trim() }),
      temperature,
      top_p,
      max_completion_tokens,
      presence_penalty,
      frequency_penalty,
    };

    console.log("=== Replicate Input Object ===");
    console.log(JSON.stringify(input, null, 2));
    console.log("=============================");

    console.log("Creating prediction with model: openai/gpt-4.1-nano");

    const prediction = await replicate.predictions.create({
      model: "openai/gpt-4.1-nano",
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
      throw new Error("Text generation timed out");
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
        "Text generation failed";
      throw new Error(`Text generation failed: ${errorMessage}`);
    }

    console.log("Final prediction:", finalPrediction);

    // Extract the output text
    const output = finalPrediction.output;
    let resultText = "";

    if (Array.isArray(output)) {
      // 배열인 경우 모든 텍스트를 연결
      resultText = output.join("");
    } else if (typeof output === "string") {
      resultText = output;
    } else {
      console.error("Unexpected output format:", output);
      throw new Error("Unexpected output format from model");
    }

    console.log("Generated text:", resultText);

    return NextResponse.json({
      text: resultText,
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
      error instanceof Error ? error.message : "Failed to generate text";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
