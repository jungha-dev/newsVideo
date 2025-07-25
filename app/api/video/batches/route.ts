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

    // 사용자의 배치들 가져오기
    const batchSnapshot = await dbAdmin
      .collection("video_batches")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();

    const batches = await Promise.all(
      batchSnapshot.docs.map(async (batchDoc) => {
        const batchData = batchDoc.data();
        const videoIds: string[] = batchData.items || [];

        // 배치에 포함된 영상들 가져오기
        const videos = await Promise.all(
          videoIds.map(async (taskId) => {
            const videoSnapshot = await dbAdmin
              .collection("videos")
              .where("runwayTaskId", "==", taskId)
              .get();
            const doc = videoSnapshot.docs[0];
            return doc ? { id: doc.id, ...doc.data() } : null;
          })
        );

        return {
          batchId: batchDoc.id,
          createdAt: batchData.createdAt?.toDate?.().toLocaleString?.() || "",
          videos: videos.filter(Boolean),
        };
      })
    );

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("Error fetching batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch batches" },
      { status: 500 }
    );
  }
}
