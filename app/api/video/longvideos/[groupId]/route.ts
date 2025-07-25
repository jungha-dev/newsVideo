import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

interface Props {
  params: Promise<{ groupId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { groupId } = await params;

    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // longvideo 그룹 문서 가져오기
    const longvideoSnap = await dbAdmin
      .collection("users")
      .doc(user.uid)
      .collection("longvideos")
      .doc(groupId)
      .get();

    if (!longvideoSnap.exists) {
      return NextResponse.json(
        { error: "Long video group not found" },
        { status: 404 }
      );
    }

    const longvideoData = longvideoSnap.data()!;

    // Timestamp 객체를 문자열로 변환하는 함수
    const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return "";
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
      }
      if (timestamp._seconds) {
        return new Date(timestamp._seconds * 1000).toLocaleString();
      }
      return timestamp.toString();
    };

    const longvideo = {
      id: longvideoSnap.id,
      title: longvideoData.title || `Long Video Group ${longvideoSnap.id}`,
      description: longvideoData.description || "",
      createdAt: formatTimestamp(longvideoData.createdAt),
      updatedAt: formatTimestamp(longvideoData.updatedAt),
      status: longvideoData.status || "completed",
      totalVideos: longvideoData.totalVideos || 0,
      videos: (longvideoData.videos || []).map((video: any) => ({
        ...video,
        createdAt: formatTimestamp(video.createdAt),
      })),
      metadata: longvideoData.metadata || {},
    };

    return NextResponse.json({
      success: true,
      longvideo,
    });
  } catch (error) {
    console.error("Error fetching longvideo group:", error);
    return NextResponse.json(
      { error: "Failed to fetch longvideo group" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // 해당 그룹이 사용자의 것인지 확인
    const groupDoc = await dbAdmin
      .collection("users")
      .doc(user.uid)
      .collection("longvideos")
      .doc(groupId)
      .get();

    if (!groupDoc.exists) {
      return NextResponse.json(
        { error: "Long video group not found" },
        { status: 404 }
      );
    }

    // 그룹 삭제
    await dbAdmin
      .collection("users")
      .doc(user.uid)
      .collection("longvideos")
      .doc(groupId)
      .delete();

    return NextResponse.json({
      success: true,
      message: "Long video group deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting long video group:", error);
    return NextResponse.json(
      { error: "Failed to delete long video group" },
      { status: 500 }
    );
  }
}
