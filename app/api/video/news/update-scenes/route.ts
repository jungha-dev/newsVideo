import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId, scenes } = await request.json();

    // 뉴스 비디오 정보 가져오기
    const videoDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .get();

    if (!videoDoc.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoData = videoDoc.data()!;

    // 씬 순서 업데이트
    const updatedScenes = scenes.map((scene: any, index: number) => ({
      ...scene,
      scene_number: index + 1, // 씬 번호 재정렬
    }));

    // Firestore 업데이트
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .update({
        scenes: updatedScenes,
        updatedAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      message: "Scenes updated successfully",
    });
  } catch (error) {
    console.error("Error updating scenes:", error);
    return NextResponse.json(
      { error: "Failed to update scenes" },
      { status: 500 }
    );
  }
}
