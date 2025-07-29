import { NextRequest, NextResponse } from "next/server";
import { uploadVideoToFirebase } from "@/lib/uploadVideoToFirebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      duration = 5,
      cfg_scale = 0.5,
      end_image,
      start_image,
      aspect_ratio = "16:9",
      negative_prompt = "",
      reference_images = [],
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Validate that either start_image or end_image is provided
    if (!start_image && !end_image) {
      return NextResponse.json(
        { error: "Either start_image or end_image is required" },
        { status: 400 }
      );
    }

    // Validate duration
    if (![5, 10].includes(duration)) {
      return NextResponse.json(
        { error: "Duration must be either 5 or 10 seconds" },
        { status: 400 }
      );
    }

    // Validate aspect_ratio
    if (!["16:9", "9:16", "1:1"].includes(aspect_ratio)) {
      return NextResponse.json(
        { error: "Aspect ratio must be one of: 16:9, 9:16, 1:1" },
        { status: 400 }
      );
    }

    // Validate cfg_scale
    if (cfg_scale < 0 || cfg_scale > 1) {
      return NextResponse.json(
        { error: "cfg_scale must be between 0 and 1" },
        { status: 400 }
      );
    }

    // Validate reference_images (max 4)
    if (reference_images.length > 4) {
      return NextResponse.json(
        { error: "Maximum 4 reference images allowed" },
        { status: 400 }
      );
    }

    const replicateRequest = {
      version: "kwaivgi/kling-v1.6-pro",
      input: {
        prompt,
        duration,
        cfg_scale,
        aspect_ratio,
        negative_prompt,
        ...(start_image && { start_image }),
        ...(end_image && { end_image }),
        ...(reference_images.length > 0 && { reference_images }),
      },
    };

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(replicateRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Replicate API error:", errorData);
      return NextResponse.json(
        { error: "Failed to start video generation" },
        { status: response.status }
      );
    }

    const prediction = await response.json();
    console.log("Prediction started:", prediction);

    return NextResponse.json(prediction);
  } catch (error) {
    console.error("Error in kling-v1.6-pro route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const predictionId = searchParams.get("id");

    if (!predictionId) {
      return NextResponse.json(
        { error: "Prediction ID is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Replicate API error:", errorData);
      return NextResponse.json(
        { error: "Failed to get prediction status" },
        { status: response.status }
      );
    }

    const prediction = await response.json();

    // 완료된 경우 Firebase에 업로드
    if (prediction.status === "succeeded" && prediction.output) {
      try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (userId) {
          const firebaseUrl = await uploadVideoToFirebase({
            replicateUrl: prediction.output,
            userId,
            fileName: `kling-v1-6-pro-${Date.now()}.mp4`,
          });

          // Firebase URL을 prediction 객체에 추가
          prediction.firebaseUrl = firebaseUrl;
          console.log("Video uploaded to Firebase:", firebaseUrl);
        }
      } catch (uploadError) {
        console.error("Failed to upload to Firebase:", uploadError);
        // Firebase 업로드 실패 시 원본 URL 사용
      }
    }

    return NextResponse.json(prediction);
  } catch (error) {
    console.error("Error getting prediction status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
