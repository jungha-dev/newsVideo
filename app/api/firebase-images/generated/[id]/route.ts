import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "../../../../../lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

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

// 생성된 이미지 삭제 API
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("=== 생성된 이미지 삭제 API 호출 ===");
    console.log("Image ID:", params.id);

    // 사용자 인증 확인
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    console.log("인증된 사용자:", user.uid);

    // Firestore 문서 참조
    const imageRef = db
      .collection("users")
      .doc(user.uid)
      .collection("generatedImg")
      .doc(params.id);

    // 문서 존재 확인
    const imageDoc = await imageRef.get();
    if (!imageDoc.exists) {
      return NextResponse.json(
        { success: false, error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const imageData = imageDoc.data();
    if (!imageData) {
      return NextResponse.json(
        { success: false, error: "이미지 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log("삭제할 이미지 데이터:", imageData);

    // Storage에서 이미지 삭제
    if (imageData.name) {
      try {
        const adminStorage = getStorage();
        const bucket = adminStorage.bucket();
        const file = bucket.file(imageData.name);
        await file.delete();
        console.log("Storage에서 이미지 삭제 완료");
      } catch (storageError) {
        console.warn("Storage 삭제 실패:", storageError);
        // Storage 삭제 실패는 치명적이지 않으므로 계속 진행
      }
    }

    // Firestore에서 문서 삭제
    await imageRef.delete();
    console.log("Firestore에서 문서 삭제 완료");

    return NextResponse.json({
      success: true,
      message: "이미지가 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    console.error("Generated image delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "이미지 삭제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
