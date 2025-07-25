// pages/api/generate.ts
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      imageUrl,
      aspectRatio,
      outputFormat,
      seed,
      safetyTolerance,
    } = await request.json();

    if (!prompt || !imageUrl) {
      return NextResponse.json(
        { error: "Missing prompt or imageUrl" },
        { status: 400 }
      );
    }

    console.log("Sending request to Replicate with:", {
      prompt,
      imageUrl,
      aspectRatio,
      outputFormat,
      seed,
      safetyTolerance,
    });

    const input: any = {
      prompt,
      input_image: imageUrl,
      aspect_ratio: aspectRatio,
      output_format: outputFormat,
      safety_tolerance: safetyTolerance,
    };

    // seed가 있는 경우에만 추가
    if (seed !== undefined && seed !== null) {
      input.seed = seed;
    }

    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input,
    });

    console.log("Replicate response:", output);
    console.log("Output type:", typeof output);
    console.log("Is array:", Array.isArray(output));

    // 방법 1: .url() 메서드 시도
    let resultImageUrl;
    try {
      if (output && typeof output === "object" && "url" in output) {
        resultImageUrl = (output as any).url();
        console.log("Using .url() method:", resultImageUrl);
      } else {
        // 방법 2: 배열에서 첫 번째 요소 가져오기
        resultImageUrl = Array.isArray(output) ? output[0] : output;
        console.log("Using array/fallback method:", resultImageUrl);
      }
    } catch (urlError) {
      console.log("URL method failed, using fallback:", urlError);
      resultImageUrl = Array.isArray(output) ? output[0] : output;
    }

    console.log("Final image URL:", resultImageUrl);

    return NextResponse.json({ imageUrl: resultImageUrl });
  } catch (error) {
    console.error("Replicate error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
