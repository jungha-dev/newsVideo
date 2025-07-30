import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "../../../../lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { getApps, initializeApp, cert } from "firebase-admin/app";

// Firebase Admin은 이미 lib/firebase-admin.ts에서 초기화됨

const storage = getStorage();

// 사용자 인증 확인 함수
async function verifyUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// 생성된 이미지 Save API
export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // JSON 데이터 파싱
    const body = await request.json();
    const {
      imageUrl,
      title,
      prompt,
      options,
      inputImageUrl, // 사용자가 입력한 이미지 링크
      characterName,
      usedImageInfo,
      usedImagesInfo,
    } = body;

    console.log("API에서 받은 데이터:", {
      imageUrl,
      title,
      prompt,
      inputImageUrl,
      characterName,
    });

    // 입력 검증
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "이미지 URL이 필요합니다." },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: "제목이 필요합니다." },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "프롬프트가 필요합니다." },
        { status: 400 }
      );
    }

    // 이미지 URL에서 이미지 다운로드
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { success: false, error: "이미지를 다운로드할 수 없습니다." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType =
      imageResponse.headers.get("content-type") || "image/png";

    // Firebase Storage에 업로드
    const bucket = storage.bucket();
    const { createSafeFilename, getUserGeneratedImagePath } = await import(
      "../../../../utils/storagePaths"
    );

    const timestamp = Date.now();
    const safeFilename = createSafeFilename(`${title}_${timestamp}`, "gen");
    const fileName = getUserGeneratedImagePath({
      userId: user.uid,
      filename: safeFilename,
    });
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });

    // 다운로드 URL 생성
    const [url] = await fileUpload.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // 매우 긴 만료 기간
    });

    // Firestore에 생성된 이미지 정보 Save
    const generatedImageData = {
      name: fileName,
      url: url,
      size: imageBuffer.length.toString(),
      contentType: contentType,
      title: title.trim(),
      prompt: prompt,
      options: options || {},
      inputImageUrl: inputImageUrl || "", // 사용자가 입력한 이미지 링크
      originalImageUrl: inputImageUrl || "", // 하위 호환성을 위해 유지
      characterName: characterName || "",
      usedImageInfo: usedImageInfo || null,
      usedImagesInfo: usedImagesInfo || [],
      email: user.email,
      createdAt: new Date(), // Firebase Timestamp로 통일
      updatedAt: new Date(), // Firebase Timestamp로 통일
    };

    const docRef = await db
      .collection("users")
      .doc(user.uid)
      .collection("generatedImg")
      .add(generatedImageData);

    return NextResponse.json({
      success: true,
      message: "생성된 이미지가 성공적으로 Save되었습니다.",
      generatedImageId: docRef.id,
      title: title.trim(),
      url: url,
    });
  } catch (error) {
    console.error("Generated image save error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "이미지 Save에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

// 생성된 이미지 목록 조회 API
export async function GET(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // Firestore에서 생성된 이미지 목록 가져오기
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("generatedImg")
      .orderBy("createdAt", "desc")
      .get();

    const generatedImages: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      generatedImages.push({
        id: doc.id,
        ...data,
      });
    });

    return NextResponse.json({
      success: true,
      count: generatedImages.length,
      generatedImages: generatedImages,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("Generated images fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "생성된 이미지 목록을 불러올 수 없습니다.",
      },
      { status: 500 }
    );
  }
}
