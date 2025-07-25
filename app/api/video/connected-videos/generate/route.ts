import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

interface ConnectedVideoRequest {
  images: string[];
  duration: 5 | 10;
  cfg_scale: number;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  negative_prompt: string;
  project_name: string;
  projectId?: string; // 기존 프로젝트 ID (선택사항)
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;

    const body: ConnectedVideoRequest = await request.json();
    const {
      images,
      duration,
      cfg_scale,
      aspect_ratio,
      negative_prompt,
      project_name,
      projectId, // 기존 프로젝트 ID
    } = body;

    // 유효성 검사
    if (!images || images.length < 2) {
      return NextResponse.json(
        { error: "At least 2 images are required" },
        { status: 400 }
      );
    }

    if (!project_name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    let projectData;
    const now = new Date();

    if (projectId) {
      // 기존 프로젝트에 영상 추가
      const existingProjectRef = db
        .collection("users")
        .doc(uid)
        .collection("connectedVideo")
        .doc(projectId);

      const existingProject = await existingProjectRef.get();
      if (!existingProject.exists) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      const existingData = existingProject.data()!;

      // 기존 이미지와 새 이미지 합치기
      const allImages = [...(existingData.images || []), ...images];

      projectData = {
        ...existingData,
        images: allImages,
        updated_at: now,
      };

      // 기존 프로젝트 업데이트
      await existingProjectRef.update({
        images: allImages,
        updated_at: now,
      });
    } else {
      // 새 프로젝트 생성
      const newProjectId = uuidv4();
      projectData = {
        id: newProjectId,
        name: project_name,
        images: images,
        duration,
        cfg_scale,
        aspect_ratio,
        negative_prompt,
        created_at: now,
        updated_at: now,
      };

      await db
        .collection("users")
        .doc(uid)
        .collection("connectedVideo")
        .doc(newProjectId)
        .set(projectData);
    }

    // 각 이미지 쌍에 대해 영상 생성 요청
    const videos: any[] = [];
    const startIndex = projectId
      ? projectData.images.length - images.length
      : 0;

    for (let i = 0; i < images.length - 1; i++) {
      const videoId = uuidv4();
      const fromImage = images[i];
      const toImage = images[i + 1];

      // Kling v1.6 Pro API 호출
      const klingResponse = await fetch(
        "https://api.replicate.com/v1/predictions",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "kwaivgi/kling-v1.6-pro",
            input: {
              prompt: `Smooth transition from one image to another, maintaining visual continuity and flow`,
              duration: duration,
              cfg_scale: cfg_scale,
              aspect_ratio: aspect_ratio,
              negative_prompt:
                negative_prompt || "blurry, low quality, distorted",
              start_image: fromImage,
              end_image: toImage,
            },
          }),
        }
      );

      if (!klingResponse.ok) {
        throw new Error(`Kling API error: ${klingResponse.statusText}`);
      }

      const klingData = await klingResponse.json();

      const videoData = {
        id: videoId,
        status: "starting" as const,
        fromImage,
        toImage,
        index: startIndex + i, // 기존 영상 인덱스에 추가
        klingPredictionId: klingData.id,
        created_at: now,
        updated_at: now,
      };

      await db
        .collection("users")
        .doc(uid)
        .collection("connectedVideo")
        .doc(projectData.id)
        .collection("videos")
        .doc(videoId)
        .set(videoData);
      videos.push(videoData);
    }

    return NextResponse.json({
      project: projectData,
      videos: videos,
      message: projectId
        ? `Added ${videos.length} new videos to existing project`
        : `Started generating ${videos.length} connected videos`,
    });
  } catch (error) {
    console.error("Error generating connected videos:", error);
    return NextResponse.json(
      { error: "Failed to generate connected videos" },
      { status: 500 }
    );
  }
}
