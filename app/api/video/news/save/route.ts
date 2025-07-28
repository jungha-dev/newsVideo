import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { saveNewsVideo } from "@/lib/firebase/newsVideo";
import { NewsVideoCreateData } from "@/lib/types/newsVideo";

export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { uid, newsVideoData } = body;

    if (!uid || !newsVideoData) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // 사용자 ID 확인
    if (uid !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 뉴스 비디오 저장
    const videoId = await saveNewsVideo(uid, newsVideoData);

    return NextResponse.json({
      success: true,
      videoId,
      message: "뉴스 비디오가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("Save news video error:", error);
    return NextResponse.json(
      {
        error: "뉴스 비디오 저장에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
