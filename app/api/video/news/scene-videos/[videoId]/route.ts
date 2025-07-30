import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await params;

    // Scene 비디오들 가져오기
    const sceneVideosSnapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .collection("sceneVideos")
      .get();

    const sceneVideos = sceneVideosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      sceneVideos,
    });
  } catch (error) {
    console.error("Error getting scene videos:", error);
    return NextResponse.json(
      { error: "Failed to get scene videos" },
      { status: 500 }
    );
  }
}
