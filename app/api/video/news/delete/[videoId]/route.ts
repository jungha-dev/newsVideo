import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

// CORS preflight 요청 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // CORS 헤더 추가
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
    };

    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers,
        }
      );
    }

    const { videoId } = await params;

    console.log(`🗑️ 비디오 삭제 시작: ${videoId}`);

    // 1. 비디오 정보 가져오기
    const videoDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .get();

    if (!videoDoc.exists) {
      return NextResponse.json(
        { error: "Video not found" },
        {
          status: 404,
          headers,
        }
      );
    }

    const videoData = videoDoc.data()!;

    // 2. Storage 파일들 삭제
    const storageFilesToDelete: string[] = [];

    // 씬 비디오 파일들 수집
    if (videoData.scenes && Array.isArray(videoData.scenes)) {
      videoData.scenes.forEach((scene: any, index: number) => {
        if (
          scene.videoUrl &&
          scene.videoUrl.includes("firebasestorage.googleapis.com")
        ) {
          try {
            const url = new URL(scene.videoUrl);
            const filePath = decodeURIComponent(
              url.pathname.split("/o/")[1]?.split("?")[0] || ""
            );
            if (filePath) {
              storageFilesToDelete.push(filePath);
            }
          } catch (error) {
            console.warn(`Failed to parse video URL: ${scene.videoUrl}`);
          }
        }
      });
    }

    // Storage 파일들 삭제
    if (storageFilesToDelete.length > 0) {
      console.log(`📁 Storage 파일 삭제: ${storageFilesToDelete.length}개`);
      const bucket = storage.bucket();

      for (const filePath of storageFilesToDelete) {
        try {
          const file = bucket.file(filePath);
          await file.delete();
          console.log(`✅ Storage 파일 삭제 완료: ${filePath}`);
        } catch (error) {
          console.warn(`⚠️ Storage 파일 삭제 실패: ${filePath}`, error);
        }
      }
    }

    // 3. sceneVideos 컬렉션 삭제
    console.log(`🗂️ sceneVideos 컬렉션 삭제`);
    const sceneVideosSnapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .collection("sceneVideos")
      .get();

    const sceneVideosDeletePromises = sceneVideosSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(sceneVideosDeletePromises);
    console.log(
      `✅ sceneVideos 삭제 완료: ${sceneVideosSnapshot.docs.length}개`
    );

    // 4. 메인 비디오 문서 삭제
    console.log(`📄 메인 비디오 문서 삭제`);
    await db
      .collection("users")
      .doc(user.uid)
      .collection("newsVideo")
      .doc(videoId)
      .delete();

    console.log(`✅ 비디오 삭제 완료: ${videoId}`);
    console.log(`   👤 사용자: ${user.uid}`);
    console.log(`   📁 삭제된 Storage 파일: ${storageFilesToDelete.length}개`);
    console.log(
      `   📄 삭제된 sceneVideos: ${sceneVideosSnapshot.docs.length}개`
    );

    return NextResponse.json(
      {
        message: "Video deleted successfully",
        deletedFiles: storageFilesToDelete.length,
        deletedSceneVideos: sceneVideosSnapshot.docs.length,
      },
      { headers }
    );
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
}
