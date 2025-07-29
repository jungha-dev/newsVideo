import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import sharp from "sharp";

// 서비스 계정 정보를 가져오는 함수
const getServiceAccount = () => {
  // 환경 변수에서 서비스 계정 정보를 가져오거나, 파일에서 로드
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // 환경 변수에서 JSON 문자열로 제공된 경우
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 파일에서 로드 (개발 환경에서만)
    try {
      const serviceAccount = require("../../../keys/serviceAccountKey.json");
      return serviceAccount;
    } catch (error) {
      console.warn(
        "Service account key file not found, using environment variables"
      );
      // 환경 변수에서 개별 필드들을 가져옴
      return {
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
};

// Firebase Admin 초기화
if (!getApps().length) {
  const serviceAccount = getServiceAccount();
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      "nesvideo-24f56.firebasestorage.com",
  });
}

const db = getFirestore(app, "news-video");
const storage = getStorage();
const auth = getAuth();

interface FirebaseImage {
  id: string;
  name: string;
  url: string;
  size: string;
  contentType: string;
  timeCreated: string;
  characterName: string;
  uploadTime: any;
  email?: string;
  category?: string;
  createdAt?: any;
  updatedAt?: any;
}

// 이미지를 80x80 크기로 리사이즈하는 함수 (카테고리용)
async function resizeImageTo80x80(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Sharp를 사용하여 이미지를 80x80으로 리사이즈
    // fit: 'contain'으로 비율을 유지하면서 80x80 안에 맞춤
    // background: 흰색 배경 설정
    const resizedBuffer = await sharp(imageBuffer)
      .resize(80, 80, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    return resizedBuffer;
  } catch (error) {
    console.error("Image resize error:", error);
    // 리사이즈 실패 시 원본 반환
    return imageBuffer;
  }
}

// 사용자 인증 확인 함수
async function verifyUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// 이미지 이미지 업로드 API
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

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const characterName = formData.get("characterName") as string;
    const category = formData.get("category") as string;

    // 입력 검증
    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 필요합니다." },
        { status: 400 }
      );
    }

    if (!characterName || !characterName.trim()) {
      return NextResponse.json(
        { success: false, error: "이미지 이름이 필요합니다." },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 파일 형식입니다." },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "파일 크기가 너무 큽니다. 최대 10MB까지 가능합니다.",
        },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const buffer = Buffer.from(await file.arrayBuffer());

    // 이미지 이미지는 원본 크기 유지 (리사이즈하지 않음)
    const uploadBuffer = buffer; // 원본 크기 유지
    const contentType = file.type; // 원본 파일 타입 유지

    // Firebase Storage에 업로드 (새로운 구조)
    const bucket = storage.bucket();
    const { getImageUploadPath, createSafeFilename } = await import(
      "../../../utils/storagePaths"
    );

    const safeFilename = createSafeFilename(file.name, "char");
    const fileName = getImageUploadPath({
      userId: user.uid,
      filename: safeFilename,
      category: category || "uncategorized",
    });
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(uploadBuffer, {
      metadata: {
        contentType: contentType, // 원본 파일 타입 유지
      },
    });

    // 다운로드 URL 생성
    const [url] = await fileUpload.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // 매우 긴 만료 기간
    });

    // Firestore에 이미지 정보 저장 (새로운 구조: users/{uid}/characters)
    const characterData = {
      name: fileName,
      url: url,
      size: uploadBuffer.length.toString(),
      contentType: contentType,
      timeCreated: new Date().toISOString(),
      characterName: characterName.trim(),
      uploadTime: new Date(),
      email: user.email,
      category: category || "uncategorized",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db
      .collection("users")
      .doc(user.uid)
      .collection("characters")
      .add(characterData);

    return NextResponse.json({
      success: true,
      message: "이미지가 성공적으로 업로드되었습니다.",
      characterId: docRef.id,
      characterName: characterName.trim(),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "업로드에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

// 이미지 목록 조회 API
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

    // 쿼리 파라미터에서 카테고리 필터 가져오기
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // Firestore에서 이미지 목록 가져오기 (새로운 구조: users/{uid}/characters)
    let query = db.collection("users").doc(user.uid).collection("characters");

    // 카테고리 필터 적용
    if (category && category !== "all") {
      query = query.where("category", "==", category) as any;
    }

    const snapshot = await query.get();

    const characters: FirebaseImage[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // storagePath가 있는 경우 URL 생성
      let imageData = { ...data };
      if (data.storagePath && !data.url) {
        const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        imageData.url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
          data.storagePath
        )}?alt=media`;
      }

      characters.push({
        id: doc.id,
        ...imageData,
      } as FirebaseImage);
    });

    // 클라이언트 사이드에서 정렬 (더 안전함)
    characters.sort((a, b) => {
      const timeA =
        a.uploadTime?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const timeB =
        b.uploadTime?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return timeB.getTime() - timeA.getTime(); // 최신순 정렬
    });

    return NextResponse.json({
      success: true,
      count: characters.length,
      characters: characters,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "이미지 목록을 가져오는데 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
