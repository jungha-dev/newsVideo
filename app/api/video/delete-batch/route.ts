import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";

// Firebase Storage URL에서 파일 경로를 추출하는 함수 (새로운 구조 지원)
const extractStoragePath = (url: string): string | null => {
  try {
    const urlObj = new URL(url);

    // Firebase Storage URL 패턴 확인
    if (!urlObj.hostname.includes("firebasestorage.googleapis.com")) {
      return null;
    }

    // URL 경로에서 파일 경로 추출
    const pathSegments = urlObj.pathname.split("/");

    // /v0/b/bucket/o/path/to/file 형식에서 path/to/file 부분 추출
    if (
      pathSegments.length >= 6 &&
      pathSegments[1] === "v0" &&
      pathSegments[2] === "b" &&
      pathSegments[4] === "o"
    ) {
      const extractedPath = decodeURIComponent(pathSegments.slice(5).join("/"));

      // 새로운 구조와 기존 구조 모두 지원
      // 새로운 구조: users/{userId}/uploads/videos/...
      // 기존 구조: videos/{taskId}.mp4
      return extractedPath;
    }

    return null;
  } catch (error) {
    console.error("Error extracting storage path from URL:", url, error);
    return null;
  }
};

export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // 배치 문서 가져오기
    const batchRef = dbAdmin.collection("video_batches").doc(batchId);
    const batchSnap = await batchRef.get();

    if (!batchSnap.exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const batchData = batchSnap.data()!;

    // 사용자 소유권 확인
    if (batchData.userId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 배치에 포함된 영상들의 taskId 목록
    const videoTaskIds: string[] = batchData.items || [];

    console.log(
      `Starting deletion of batch ${batchId} with ${videoTaskIds.length} videos`
    );

    // 1. 영상 문서들 삭제
    const videoDeletionPromises = videoTaskIds.map(async (taskId) => {
      const videoSnapshot = await dbAdmin
        .collection("videos")
        .where("runwayTaskId", "==", taskId)
        .get();

      const deletionPromises = videoSnapshot.docs.map(async (videoDoc) => {
        const videoData = videoDoc.data();

        // Firebase Storage에서 영상 파일 삭제
        if (videoData.firebaseVideoUrl) {
          try {
            const storagePath = extractStoragePath(videoData.firebaseVideoUrl);

            if (storagePath) {
              const storageRef = ref(storage, storagePath);
              await deleteObject(storageRef);
              console.log(`✅ Deleted video file: ${storagePath}`);
            } else {
              console.warn(
                `⚠️ Could not extract storage path from URL: ${videoData.firebaseVideoUrl}`
              );
            }
          } catch (storageError) {
            console.error(
              `❌ Failed to delete video file: ${videoData.firebaseVideoUrl}`,
              storageError
            );
            // 파일 삭제 실패해도 문서는 삭제 진행
          }
        } else {
          console.log(`ℹ️ No firebaseVideoUrl found for video ${videoDoc.id}`);
        }

        // 영상 문서 삭제
        await videoDoc.ref.delete();
        console.log(`✅ Deleted video document: ${videoDoc.id}`);

        return videoDoc.id;
      });

      return Promise.all(deletionPromises);
    });

    // 2. 모든 영상 삭제 실행
    const deletedVideoIds = await Promise.all(videoDeletionPromises);
    const totalDeletedVideos = deletedVideoIds.flat().length;

    // 3. 배치 문서 삭제
    await batchRef.delete();
    console.log(`✅ Deleted batch document: ${batchId}`);

    console.log(
      `🎉 Successfully deleted batch ${batchId} and ${totalDeletedVideos} videos`
    );

    return NextResponse.json({
      success: true,
      message: "Batch and all related videos deleted successfully",
      deletedBatchId: batchId,
      deletedVideoCount: totalDeletedVideos,
    });
  } catch (error) {
    console.error("❌ Error deleting batch:", error);
    return NextResponse.json(
      { error: "Failed to delete batch" },
      { status: 500 }
    );
  }
}
