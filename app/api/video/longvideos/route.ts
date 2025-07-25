import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자의 longvideos 그룹들 가져오기
    const longvideosSnapshot = await dbAdmin
      .collection("users")
      .doc(user.uid)
      .collection("longvideos")
      .orderBy("createdAt", "desc")
      .get();

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

    const longvideos = longvideosSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || `Long Video Group ${doc.id}`,
        description: data.description || "",
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
        status: data.status || "completed",
        totalVideos: data.totalVideos || 0,
        videos: (data.videos || []).map((video: any) => ({
          ...video,
          createdAt: formatTimestamp(video.createdAt),
        })),
        metadata: data.metadata || {},
      };
    });

    return NextResponse.json({
      success: true,
      longvideos,
    });
  } catch (error) {
    console.error("Error fetching longvideos:", error);
    return NextResponse.json(
      { error: "Failed to fetch longvideos" },
      { status: 500 }
    );
  }
}
