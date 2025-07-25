import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

// Firebase Storage URL을 올바른 형식으로 변환하는 함수
const ensureFirebaseUrl = (url: string): string => {
  if (!url || typeof url !== "string") {
    return url;
  }

  // Firebase Storage URL 패턴 확인
  if (url.includes("firebasestorage.googleapis.com")) {
    // 이미 ?alt=media가 포함되어 있는지 확인
    if (url.includes("?alt=media")) {
      return url;
    }

    // 기존 쿼리 파라미터가 있는지 확인
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}alt=media`;
  }

  return url;
};

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // 프로젝트의 영상들 가져오기
    const videosRef = db
      .collection("users")
      .doc(uid)
      .collection("connectedVideo")
      .doc(projectId)
      .collection("videos");
    const snapshot = await videosRef.get();

    // 클라이언트에서 정렬 (인덱스 없이 작동)
    const videos: any[] = [];

    for (const doc of snapshot.docs) {
      const videoData = doc.data();

      // Kling API에서 최신 상태 확인 (처리 중인 영상들만)
      if (
        videoData.klingPredictionId &&
        videoData.status !== "succeeded" &&
        videoData.status !== "failed"
      ) {
        try {
          const klingResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${videoData.klingPredictionId}`,
            {
              headers: {
                Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
              },
            }
          );

          if (klingResponse.ok) {
            const klingData = await klingResponse.json();

            // 상태 업데이트
            const updatedStatus = klingData.status;
            let updatedData = {
              ...videoData,
              status: updatedStatus,
              output: klingData.output,
              error: klingData.error,
              updated_at: new Date(),
            };

            // 영상이 완료되면 원본 URL 유지 (Firebase Storage 저장은 선택사항)
            if (updatedStatus === "succeeded" && klingData.output) {
              // Replicate output이 배열인 경우 첫 번째 요소 사용
              const replicateUrl = Array.isArray(klingData.output)
                ? klingData.output[0]
                : klingData.output;

              // 원본 Replicate URL을 그대로 유지 (접근 권한 문제 없음)
              updatedData.output = replicateUrl;

              // 기존 Firebase Storage URL이 있다면 Replicate URL로 교체
              if (videoData.output && videoData.output.includes("firebase")) {
                console.log(
                  `Replacing Firebase URL with Replicate URL for video ${doc.id}`
                );
              }

              // Replicate URL을 Firebase Storage에 업로드하여 영구적인 URL로 교체
              try {
                console.log(
                  `🔄 Firebase Storage 업로드 시작: ${klingData.output}`
                );

                const { getConnectedVideoPath, createSafeFilename } =
                  await import("../../../../../utils/storagePaths");
                const filename = createSafeFilename(
                  `video_${videoData.index + 1}.mp4`,
                  "connected"
                );
                const storagePath = getConnectedVideoPath({
                  userId: uid,
                  filename: filename,
                });

                // 영상 다운로드 및 Firebase Storage에 업로드
                const videoResponse = await fetch(klingData.output);
                if (!videoResponse.ok) {
                  throw new Error(
                    `Failed to fetch video: ${videoResponse.status}`
                  );
                }
                const videoBuffer = await videoResponse.arrayBuffer();

                const { getStorage } = await import("firebase-admin/storage");
                const adminStorage = getStorage();
                const bucket = adminStorage.bucket();

                const file = bucket.file(storagePath);
                await file.save(Buffer.from(videoBuffer), {
                  metadata: {
                    contentType: "video/mp4",
                  },
                });

                // 파일을 공개로 설정
                await file.makePublic();

                // 공개 URL 생성
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

                console.log(`✅ Firebase Storage 업로드 완료: ${publicUrl}`);
                updatedData.output = publicUrl; // 공개 URL로 교체
              } catch (storageError) {
                console.error(
                  "Error saving video to Firebase Storage:",
                  storageError
                );
                // Firebase Storage 저장 실패해도 원본 Replicate URL 유지
                console.log(
                  `⚠️ Firebase Storage 업로드 실패, 원본 URL 유지: ${klingData.output}`
                );
              }
            }

            await doc.ref.update(updatedData);
            videos.push({
              id: doc.id,
              ...updatedData,
              created_at:
                videoData.created_at?.toDate?.() || videoData.created_at,
              updated_at: updatedData.updated_at,
            });
          } else {
            videos.push({
              id: doc.id,
              ...videoData,
              created_at:
                videoData.created_at?.toDate?.() || videoData.created_at,
              updated_at:
                videoData.updated_at?.toDate?.() || videoData.updated_at,
            });
          }
        } catch (error) {
          console.error("Error checking Kling status:", error);
          videos.push({
            id: doc.id,
            ...videoData,
            created_at:
              videoData.created_at?.toDate?.() || videoData.created_at,
            updated_at:
              videoData.updated_at?.toDate?.() || videoData.updated_at,
          });
        }
      } else {
        // 이미 완료되었거나 시작 중인 영상들도 포함
        let processedVideoData = { ...videoData };

        // 기존의 문제가 있던 Firebase URL만 제거 (새로 업로드된 것은 유지)
        if (
          videoData.output &&
          videoData.output.includes("firebase") &&
          videoData.output.includes("firebasestorage.googleapis.com") &&
          !videoData.output.includes("?alt=media")
        ) {
          console.log(
            `Removing problematic Firebase URL for video ${doc.id}: ${videoData.output}`
          );
          processedVideoData = {
            ...videoData,
            output: undefined,
            error:
              "Firebase Storage 접근 권한 문제로 인해 영상을 불러올 수 없습니다.",
            status: "failed",
          };

          // Firestore 업데이트
          await doc.ref.update(processedVideoData);
        }

        videos.push({
          id: doc.id,
          ...processedVideoData,
          created_at:
            processedVideoData.created_at?.toDate?.() ||
            processedVideoData.created_at,
          updated_at:
            processedVideoData.updated_at?.toDate?.() ||
            processedVideoData.updated_at,
        });
      }
    }

    // index 순서로 정렬
    videos.sort((a: any, b: any) => a.index - b.index);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error fetching video status:", error);
    return NextResponse.json(
      { error: "Failed to fetch video status" },
      { status: 500 }
    );
  }
}
