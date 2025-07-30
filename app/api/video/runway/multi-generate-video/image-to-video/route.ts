// app/api/video/runway/multi-generate-video/image-to-video/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { v4 as uuidv4 } from "uuid";
import { getUserFromToken } from "@/lib/auth";
import { uploadMultiRunwayVideoToFirebase } from "@/lib/uploadMultiRunwayVideos";
import RunwayML, { TaskFailedError } from "@runwayml/sdk";

// Firebase Admin 초기화 (이미 초기화되어 있지 않은 경우에만)
if (!getApps().length) {
  // 환경 변수에서 서비스 계정 정보를 가져오거나, 파일에서 로드
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // 환경 변수에서 JSON 문자열로 제공된 경우
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 파일에서 로드 (개발 환경에서만)
    try {
      const path = require("path");
      serviceAccount = require(path.join(
        process.cwd(),
        "keys",
        "serviceAccountKey.json"
      ));
    } catch (error) {
      console.warn(
        "Service account key file not found, using environment variables"
      );
      // 환경 변수에서 개별 필드들을 가져옴
      serviceAccount = {
        type: process.env.FIREBASE_TYPE || "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri:
          process.env.FIREBASE_AUTH_URI ||
          "https://accounts.google.com/o/oauth2/auth",
        token_uri:
          process.env.FIREBASE_TOKEN_URI ||
          "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL ||
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      };
    }
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore("news-video");

// Firebase Storage URL을 올바른 형식으로 변환하는 유틸리티 함수
const ensureFirebaseUrl = (url: string): string => {
  if (!url || typeof url !== "string") {
    console.warn("Invalid URL provided to ensureFirebaseUrl:", url);
    return url;
  }

  console.log("=== ensureFirebaseUrl Processing ===");
  console.log("Input URL:", url);

  // Firebase Storage URL 패턴 확인
  if (url.includes("firebasestorage.googleapis.com")) {
    console.log("Firebase Storage URL detected");

    // 이미 ?alt=media가 포함되어 있는지 확인
    if (url.includes("?alt=media")) {
      console.log("✅ URL already contains ?alt=media");
      return url;
    }

    // 기존 쿼리 파라미터가 있는지 확인
    const separator = url.includes("?") ? "&" : "?";
    const correctedUrl = `${url}${separator}alt=media`;

    console.log("URL correction applied:", {
      original: url,
      corrected: correctedUrl,
      separator: separator,
    });

    return correctedUrl;
  }

  console.log("Non-Firebase URL, no correction needed");
  return url;
};

// 이미지 URL을 Data URI로 변환하는 함수
const convertImageUrlToDataUri = async (imageUrl: string): Promise<string> => {
  try {
    console.log("🔄 Converting image URL to Data URI:", imageUrl);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";

    const dataUri = `data:${contentType};base64,${base64}`;
    console.log("✅ Image converted to Data URI successfully");

    return dataUri;
  } catch (error) {
    console.error("❌ Failed to convert image to Data URI:", error);
    throw error;
  }
};

// 이미지 URL 테스트용 GET 엔드포인트
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    console.log("=== Image URL Test ===");
    console.log("Original URL:", imageUrl);

    const correctedUrl = ensureFirebaseUrl(imageUrl);
    console.log("Corrected URL:", correctedUrl);

    // URL 유효성 검사
    try {
      new URL(correctedUrl);
    } catch (urlError) {
      return NextResponse.json(
        {
          error: "Invalid URL format",
          original: imageUrl,
          corrected: correctedUrl,
        },
        { status: 400 }
      );
    }

    // 이미지 접근성 테스트
    try {
      const imageTestRes = await fetch(correctedUrl, { method: "HEAD" });
      const headers = Object.fromEntries(imageTestRes.headers.entries());

      return NextResponse.json({
        success: imageTestRes.ok,
        status: imageTestRes.status,
        statusText: imageTestRes.statusText,
        originalUrl: imageUrl,
        correctedUrl: correctedUrl,
        headers: headers,
        contentType: headers["content-type"],
        contentLength: headers["content-length"],
      });
    } catch (imageTestError) {
      return NextResponse.json(
        {
          success: false,
          error: "Image accessibility test failed",
          originalUrl: imageUrl,
          correctedUrl: correctedUrl,
          details:
            imageTestError instanceof Error
              ? imageTestError.message
              : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Image URL test error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== Runway Image-to-Video API 호출 (SDK) ===");
    console.log("Environment check:", {
      hasRunwayApiSecret: !!process.env.RUNWAY_API_SECRET,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      nodeEnv: process.env.NODE_ENV,
    });

    // 요청 본문 파싱
    let items;
    try {
      const body = await req.json();
      items = body.items;
      console.log("📥 요청 데이터:", {
        hasItems: !!items,
        itemsLength: items?.length,
        itemsType: typeof items,
      });
    } catch (parseError) {
      console.error("❌ 요청 본문 파싱 실패:", parseError);
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items 배열이 필요합니다." },
        { status: 400 }
      );
    }

    // 각 item: { imageUrl, promptText, description } 이어야 함
    for (const it of items) {
      if (!it.imageUrl || !it.promptText) {
        return NextResponse.json(
          { error: "imageUrl 또는 promptText 누락" },
          { status: 400 }
        );
      }
    }

    // 🔐 인증된 사용자 UID 가져오기
    const user = await getUserFromToken();

    if (!user) {
      console.error("❌ 인증 실패: 사용자 토큰이 유효하지 않습니다.");
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "사용자 인증이 필요합니다. 다시 로그인해주세요.",
        },
        { status: 401 }
      );
    }
    const uid = user.uid;

    console.log("✅ User authenticated:", { uid, email: user.email });

    // API 키 확인
    if (!process.env.RUNWAY_API_SECRET) {
      console.error("❌ RUNWAY_API_SECRET 환경변수가 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "Runway API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Runway SDK 클라이언트 초기화
    const client = new RunwayML({
      apiKey: process.env.RUNWAY_API_SECRET,
    });

    const groupId = `longvideo_${uuidv4()}`;
    const results: {
      imageUrl: string;
      taskId: string;
      videoId: string;
      firebaseVideoUrl: string | null;
      promptText: string;
      description?: string;
    }[] = [];

    console.log(`Processing ${items.length} items for group ${groupId}`);

    for (const { imageUrl, promptText, description } of items) {
      console.log("🔄 Runway API 호출 시작:", { imageUrl, promptText });

      // Firebase Storage URL 수정
      const correctedImageUrl = ensureFirebaseUrl(imageUrl);
      console.log("Image URL correction:", {
        original: imageUrl,
        corrected: correctedImageUrl,
      });

      // URL 유효성 검사
      try {
        new URL(correctedImageUrl);
      } catch (urlError) {
        console.error("❌ Invalid URL format:", correctedImageUrl);
        console.warn(`⚠️ Skipping invalid image URL: ${correctedImageUrl}`);
        continue; // 개별 이미지 오류는 기록하고 계속 진행
      }

      // 이미지 접근성 테스트 (선택적)
      try {
        console.log("Testing image accessibility...");
        const imageTestRes = await fetch(correctedImageUrl, { method: "HEAD" });
        console.log("Image test response:", {
          status: imageTestRes.status,
          statusText: imageTestRes.statusText,
          headers: Object.fromEntries(imageTestRes.headers.entries()),
        });

        if (!imageTestRes.ok) {
          console.warn("⚠️ Image accessibility test failed:", {
            url: correctedImageUrl,
            status: imageTestRes.status,
            statusText: imageTestRes.statusText,
          });

          // Firebase Storage 권한 오류인지 확인
          if (imageTestRes.status === 403) {
            console.error("❌ Firebase Storage 권한 오류 감지");
            console.warn(
              `⚠️ Skipping image with access error: ${correctedImageUrl}`
            );
            continue; // 개별 이미지 오류는 기록하고 계속 진행
          }
        } else {
          console.log("✅ Image accessibility test passed");
        }
      } catch (imageTestError) {
        console.warn("⚠️ Image accessibility test failed:", imageTestError);

        // 네트워크 오류인지 확인
        if (
          imageTestError instanceof Error &&
          imageTestError.message.includes("fetch")
        ) {
          console.error("❌ 네트워크 오류로 이미지 접근 실패");
          console.warn(
            `⚠️ Skipping image with network error: ${correctedImageUrl}`
          );
          continue; // 개별 이미지 오류는 기록하고 계속 진행
        }
      }

      try {
        // 이미지를 Data URI로 변환
        const dataUri = await convertImageUrlToDataUri(correctedImageUrl);

        // Data URI 크기 확인 (Runway 제한: 5MB로 더 엄격하게 제한)
        const dataUriSize = Math.ceil(dataUri.length * 0.75); // base64 크기 추정
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB

        console.log("📏 이미지 크기 확인:", {
          dataUriSize: `${(dataUriSize / 1024 / 1024).toFixed(2)}MB`,
          maxSize: `${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB`,
          isOverLimit: dataUriSize > maxSizeBytes,
        });

        if (dataUriSize > maxSizeBytes) {
          console.error("❌ 이미지가 너무 큽니다:", dataUriSize, "bytes");
          console.warn(
            `⚠️ Skipping oversized image: ${correctedImageUrl} (${(
              dataUriSize /
              1024 /
              1024
            ).toFixed(2)}MB)`
          );
          continue; // 개별 이미지 오류는 기록하고 계속 진행
        }

        console.log("📤 Runway SDK 요청 시작");

        // 프롬프트 텍스트 검증 및 기본값 설정
        const validatedPrompt =
          promptText?.trim() || "A beautiful animated scene";

        // Runway SDK를 사용하여 이미지-투-비디오 생성
        const task = await client.imageToVideo
          .create({
            model: "gen3a_turbo", // 더 안정적인 모델 사용
            promptImage: dataUri,
            promptText: validatedPrompt,
            ratio: "1280:768", // gen3a_turbo 모델에서 허용하는 ratio
            duration: 5,
          })
          .waitForTaskOutput();

        console.log("🔥 Runway SDK 응답:", task);

        // Runway SDK 응답에서 비디오 URL 추출
        let videoUrl: string | undefined;

        if (Array.isArray(task.output)) {
          const firstOutput = task.output[0];
          videoUrl =
            typeof firstOutput === "string"
              ? firstOutput
              : (firstOutput as any)?.videoUrl;
        } else if (typeof task.output === "string") {
          videoUrl = task.output;
        } else {
          videoUrl = (task.output as any)?.videoUrl;
        }

        if (!task || !videoUrl) {
          console.error("❌ Runway 응답에 비디오 URL이 없습니다:", task);
          console.warn(
            `⚠️ Skipping image with Runway error: ${correctedImageUrl}`
          );
          continue; // 개별 이미지 오류는 기록하고 계속 진행
        }

        const videoId = `vid_${uuidv4()}`;
        const firebaseVideoUrl = await uploadMultiRunwayVideoToFirebase(
          videoUrl
        );

        // 결과에 비디오 정보 추가
        results.push({
          imageUrl: ensureFirebaseUrl(imageUrl),
          taskId: task.id || `task_${uuidv4()}`,
          videoId,
          firebaseVideoUrl: firebaseVideoUrl
            ? ensureFirebaseUrl(firebaseVideoUrl)
            : null,
          promptText: validatedPrompt,
          description,
        });

        console.log("✅ 비디오 생성 완료:", {
          videoId,
          taskId: task.id,
          firebaseVideoUrl,
        });
      } catch (error) {
        console.error("❌ Runway SDK 오류:", error);

        if (error instanceof TaskFailedError) {
          console.error("The video failed to generate.");
          console.error(error.taskDetails);
          console.warn(
            `⚠️ Skipping image with Runway task failure: ${correctedImageUrl}`
          );
        } else {
          console.warn(
            `⚠️ Skipping image with Runway API error: ${correctedImageUrl}`
          );
        }
        continue; // 개별 이미지 오류는 기록하고 계속 진행
      }
    }

    // longvideos 그룹 정보 Firestore Save 시도 (실패해도 비디오는 성공)
    try {
      await db
        .collection("users")
        .doc(uid)
        .collection("longvideos")
        .doc(groupId)
        .set({
          id: groupId,
          userId: uid,
          createdAt: new Date(),
          updatedAt: new Date(),
          title: `Long Video Group ${new Date().toLocaleDateString()}`,
          description: `Generated on ${new Date().toLocaleString()}`,
          status: "completed",
          totalVideos: results.length,
          videos: results.map((video) => ({
            id: video.videoId,
            imageUrl: video.imageUrl,
            firebaseVideoUrl: video.firebaseVideoUrl,
            promptText: video.promptText,
            description: video.description,
            runwayTaskId: video.taskId,
            createdAt: new Date(),
          })),
          metadata: {
            runwayModel: "gen3a_turbo",
            ratio: "1280:768",
            duration: 5,
          },
        });
      console.log("✅ Long Video 그룹 Firestore Save 성공");
    } catch (firestoreError) {
      console.warn(
        "⚠️ Long Video 그룹 Firestore Save 실패 (비디오는 성공):",
        firestoreError
      );
    }

    // 결과 요약
    const totalItems = items.length;
    const successfulVideos = results.length;
    const failedItems = totalItems - successfulVideos;

    console.log(
      `📊 처리 결과: ${successfulVideos}/${totalItems} 성공, ${failedItems} 실패`
    );

    if (successfulVideos === 0) {
      return NextResponse.json(
        {
          error: "모든 이미지 처리에 실패했습니다",
          details: `${totalItems}개의 이미지 중 ${successfulVideos}개만 성공했습니다.`,
          suggestions: [
            "이미지 크기를 확인해주세요 (5MB 이하)",
            "이미지 형식을 확인해주세요",
            "인터넷 연결을 확인해주세요",
            "잠시 후 다시 시도해주세요",
          ],
          totalItems,
          successfulVideos,
          failedItems,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      groupId,
      results,
      summary: {
        totalItems,
        successfulVideos,
        failedItems,
        message:
          failedItems > 0
            ? `${successfulVideos}개 비디오 생성 성공, ${failedItems}개 실패`
            : `모든 ${successfulVideos}개 비디오 생성 성공`,
      },
    });
  } catch (err: any) {
    console.error("❌ multi-generate-video 오류:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
