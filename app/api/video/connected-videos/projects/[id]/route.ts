import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

interface UpdateProjectRequest {
  name: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;
    const projectId = params.id;
    const body: UpdateProjectRequest = await request.json();
    const { name } = body;

    // 유효성 검사
    if (!name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // 프로젝트 존재 확인
    const projectRef = db
      .collection("users")
      .doc(uid)
      .collection("connectedVideo")
      .doc(projectId);

    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 프로젝트 업데이트
    await projectRef.update({
      name: name.trim(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;
    const projectId = params.id;

    // 프로젝트 존재 확인
    const projectRef = db
      .collection("users")
      .doc(uid)
      .collection("connectedVideo")
      .doc(projectId);

    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 프로젝트 내 모든 영상 삭제
    const videosRef = projectRef.collection("videos");
    const videosSnapshot = await videosRef.get();

    const deletePromises = videosSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(deletePromises);

    // 프로젝트 삭제
    await projectRef.delete();

    return NextResponse.json({
      message: "Project and all videos deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
