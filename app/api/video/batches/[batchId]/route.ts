import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

interface Props {
  params: { batchId: string };
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { batchId } = params;

    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // 배치 문서 가져오기
    const batchSnap = await dbAdmin
      .collection("video_batches")
      .doc(batchId)
      .get();

    if (!batchSnap.exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const batchData = batchSnap.data()!;

    // 사용자 소유권 확인
    if (batchData.userId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 영상 리스트 조회
    const videoIds: string[] = batchData.items || [];

    const videos = await Promise.all(
      videoIds.map(async (taskId) => {
        const videoSnap = await dbAdmin
          .collection("videos")
          .where("runwayTaskId", "==", taskId)
          .limit(1)
          .get();

        const doc = videoSnap.docs[0];
        return doc ? { id: doc.id, ...doc.data() } : null;
      })
    ).then((v) => v.filter(Boolean)); // null 제거

    const batch = {
      batchId: batchSnap.id,
      createdAt: batchData.createdAt?.toDate?.().toLocaleString?.() || "",
      videos: videos,
    };

    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (error) {
    console.error("Error fetching batch:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch" },
      { status: 500 }
    );
  }
}
