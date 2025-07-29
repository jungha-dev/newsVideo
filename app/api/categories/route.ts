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

const db = getFirestore("news-video");
const storage = getStorage();
const auth = getAuth();

interface Category {
  id: string;
  name: string;
  description?: string;
  previewImage?: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

// 이미지를 80x80 크기로 리사이즈하는 함수
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

// 카테고리 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("=== API: Fetching Categories ===");

    // 사용자 인증 확인
    const user = await verifyUser(request);

    if (!user) {
      console.log("User not authenticated, returning empty array");
      return NextResponse.json({
        success: true,
        categories: [],
        count: 0,
        message: "로그인이 필요합니다.",
      });
    }

    console.log("Authenticated user:", user.email);

    // Firestore에서 해당 사용자의 카테고리 정보 가져오기
    const categoriesRef = db
      .collection("users")
      .doc(user.uid)
      .collection("categories");

    // order 필드가 없는 문서들이 있을 수 있으므로 단순히 createdAt으로 정렬
    const snapshot = await categoriesRef.orderBy("createdAt", "desc").get();

    console.log(
      `Total categories found for user ${user.email}: ${snapshot.docs.length}`
    );

    const categories: Category[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        description: data.description,
        previewImage: data.previewImage,
        order: data.order || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      });
    });

    return NextResponse.json({
      success: true,
      categories: categories,
      count: categories.length,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("API Error fetching categories:", error);
    return NextResponse.json(
      {
        success: false,
        error: "카테고리 정보를 불러오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

// 카테고리 추가
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

    const storage = getStorage();
    const bucket = storage.bucket();

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const imageFile = formData.get("image") as File;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "카테고리 이름이 필요합니다." },
        { status: 400 }
      );
    }

    let previewImageUrl = "";

    // 이미지가 있는 경우 업로드
    if (imageFile) {
      // 파일 타입 검증
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(imageFile.type)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid file type. Only PNG, JPEG, GIF, and WebP are allowed.",
          },
          { status: 400 }
        );
      }

      // 파일 크기 검증 (5MB 제한)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSize) {
        return NextResponse.json(
          {
            success: false,
            error: "File size too large. Maximum size is 5MB.",
          },
          { status: 400 }
        );
      }

      // 파일명 생성 (새로운 구조)
      const { getImageUploadPath, createSafeFilename } = await import(
        "../../../utils/storagePaths"
      );

      const safeFilename = createSafeFilename(imageFile.name, "cat");
      const fileName = getImageUploadPath({
        userId: user.uid,
        filename: safeFilename,
        category: "category",
      });

      // 파일을 Buffer로 변환
      const buffer = Buffer.from(await imageFile.arrayBuffer());

      // 이미지를 80x80 크기로 리사이즈
      const resizedBuffer = await resizeImageTo80x80(buffer);

      // Firebase Storage에 업로드
      const fileUpload = bucket.file(fileName);
      await fileUpload.save(resizedBuffer, {
        metadata: {
          contentType: imageFile.type,
        },
      });

      console.log("Category image uploaded successfully:", fileName);

      // 업로드된 파일의 서명된 URL 생성
      const [url] = await fileUpload.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일 유효
        version: "v4",
      });

      previewImageUrl = url;
    }

    // 현재 카테고리 개수를 확인하여 order 설정
    const existingCategories = await db
      .collection("users")
      .doc(user.uid)
      .collection("categories")
      .get();

    const nextOrder = existingCategories.docs.length;

    // Firestore에 카테고리 정보 저장
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || "",
      previewImage: previewImageUrl,
      order: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db
      .collection("users")
      .doc(user.uid)
      .collection("categories")
      .add(categoryData);
    console.log("Category saved to Firestore with ID:", docRef.id);

    return NextResponse.json({
      success: true,
      message: "카테고리가 성공적으로 추가되었습니다.",
      categoryId: docRef.id,
      categoryName: name.trim(),
      previewImage: previewImageUrl,
    });
  } catch (error) {
    console.error("Category creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "카테고리 생성에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// 카테고리 삭제
export async function DELETE(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const user = await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");
    const categoryName = searchParams.get("name");

    if (!categoryId || !categoryName) {
      return NextResponse.json(
        { success: false, error: "카테고리 ID와 이름이 필요합니다." },
        { status: 400 }
      );
    }

    console.log(`Deleting category: ${categoryName} (ID: ${categoryId})`);

    // 1. 해당 카테고리에 속한 이미지들을 uncategorized로 이동
    const charactersRef = db
      .collection("users")
      .doc(user.uid)
      .collection("characters");

    const charactersSnapshot = await charactersRef
      .where("category", "==", categoryName)
      .get();

    console.log(
      `Found ${charactersSnapshot.docs.length} characters in category: ${categoryName}`
    );

    // 배치 업데이트를 위한 준비
    const batch = db.batch();

    charactersSnapshot.docs.forEach((doc) => {
      const characterRef = doc.ref;
      batch.update(characterRef, {
        category: "uncategorized",
        updatedAt: new Date(),
      });
    });

    // 2. 카테고리 문서 삭제
    const categoryRef = db
      .collection("users")
      .doc(user.uid)
      .collection("categories")
      .doc(categoryId);

    batch.delete(categoryRef);

    // 3. 배치 실행
    await batch.commit();

    console.log(`Successfully deleted category: ${categoryName}`);
    console.log(
      `Moved ${charactersSnapshot.docs.length} characters to uncategorized`
    );

    return NextResponse.json({
      success: true,
      message: `카테고리 "${categoryName}"이(가) 삭제되었습니다.`,
      movedCharactersCount: charactersSnapshot.docs.length,
    });
  } catch (error) {
    console.error("Category deletion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "카테고리 삭제에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
