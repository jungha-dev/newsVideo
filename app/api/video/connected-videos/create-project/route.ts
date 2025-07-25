import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

interface CreateProjectRequest {
  project_name: string;
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;
    const body: CreateProjectRequest = await request.json();
    const { project_name } = body;

    // 유효성 검사
    if (!project_name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const newProjectId = uuidv4();

    const projectData = {
      id: newProjectId,
      name: project_name.trim(),
      images: [], // 빈 이미지 배열
      duration: 5,
      cfg_scale: 0.5,
      aspect_ratio: "16:9",
      negative_prompt: "",
      positive_prompt: "",
      created_at: now,
      updated_at: now,
    };

    // 새 프로젝트 생성
    await db
      .collection("users")
      .doc(uid)
      .collection("connectedVideo")
      .doc(newProjectId)
      .set(projectData);

    return NextResponse.json({
      project: projectData,
      message: "Project created successfully",
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
