import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "../../../../lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

// 이미지 편집 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("=== 이미지 편집 API 호출 ===");
    console.log("Image ID:", params.id);

    // 인증 확인
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log("인증된 사용자:", userId);
    console.log("찾을 문서 경로:", `users/${userId}/characters/${params.id}`);

    // FormData 파싱
    const formData = await request.formData();
    const characterName = formData.get("characterName") as string;
    const category = formData.get("category") as string;
    const newImage = formData.get("newImage") as File | null;

    console.log("편집 데이터:", {
      characterName,
      category,
      hasNewImage: !!newImage,
    });

    if (!characterName?.trim()) {
      return NextResponse.json(
        { error: "이미지 이름은 필수입니다." },
        { status: 400 }
      );
    }

    // Firestore 문서 참조
    const imageRef = db
      .collection("users")
      .doc(userId)
      .collection("characters")
      .doc(params.id);

    // 문서 존재 확인
    const imageDoc = await imageRef.get();
    console.log("문서 존재 여부:", imageDoc.exists);
    console.log("문서 ID:", imageDoc.id);
    console.log("문서 경로:", imageDoc.ref.path);

    if (!imageDoc.exists) {
      console.log("문서를 찾을 수 없음 - 전체 컬렉션 확인");
      // 전체 컬렉션에서 문서 목록 확인
      const collectionRef = db
        .collection("users")
        .doc(userId)
        .collection("characters");
      const collectionSnapshot = await collectionRef.get();
      console.log("전체 문서 수:", collectionSnapshot.docs.length);
      collectionSnapshot.docs.forEach((doc) => {
        console.log("존재하는 문서 ID:", doc.id);
      });

      return NextResponse.json(
        { error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const imageData = imageDoc.data();
    if (!imageData) {
      return NextResponse.json(
        { error: "이미지 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log("기존 이미지 데이터:", imageData);

    // 업데이트할 데이터 준비
    const updateData: any = {
      characterName: characterName.trim(),
      category: category || "uncategorized",
      updatedAt: new Date(),
    };

    let newImageUrl = imageData.url;
    let newStoragePath = imageData.storagePath;

    // 새 이미지가 있는 경우 업로드
    if (newImage) {
      console.log("새 이미지 업로드 시작");

      // Firebase Admin Storage 초기화
      const adminStorage = getStorage();
      const bucket = adminStorage.bucket();

      // 기존 이미지 삭제
      if (imageData.storagePath) {
        try {
          const oldFile = bucket.file(imageData.storagePath);
          await oldFile.delete();
          console.log("기존 이미지 삭제 완료");
        } catch (deleteError) {
          console.warn("기존 이미지 삭제 실패:", deleteError);
        }
      }

      // 새 이미지 업로드 (새로운 구조)
      const { getImageUploadPath, createSafeFilename } = await import(
        "../../../../utils/storagePaths"
      );

      const safeFilename = createSafeFilename(newImage.name, "edit");
      const filePath = getImageUploadPath({
        userId: userId,
        filename: safeFilename,
        category: category || "uncategorized",
      });
      const newFile = bucket.file(filePath);

      const bytes = await new Response(newImage).arrayBuffer();
      await newFile.save(Buffer.from(bytes), {
        metadata: {
          contentType: newImage.type,
        },
      });

      // 공개 URL 생성
      await newFile.makePublic();
      newImageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      newStoragePath = filePath;

      updateData.url = newImageUrl;
      updateData.storagePath = newStoragePath;

      console.log("새 이미지 업로드 완료:", newImageUrl);
    }

    // Firestore 업데이트
    await imageRef.update(updateData);
    console.log("Firestore 업데이트 완료");

    return NextResponse.json({
      success: true,
      message: "이미지가 성공적으로 업데이트되었습니다.",
      url: newImageUrl,
    });
  } catch (error) {
    console.error("이미지 편집 오류:", error);
    return NextResponse.json(
      {
        error: "이미지 편집 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

// 이미지 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("=== 이미지 삭제 API 호출 ===");
    console.log("Image ID:", params.id);

    // 인증 확인
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log("인증된 사용자:", userId);

    // Firestore 문서 참조
    const imageRef = db
      .collection("users")
      .doc(userId)
      .collection("characters")
      .doc(params.id);

    // 문서 존재 확인
    const imageDoc = await imageRef.get();
    if (!imageDoc.exists) {
      return NextResponse.json(
        { error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const imageData = imageDoc.data();
    if (!imageData) {
      return NextResponse.json(
        { error: "이미지 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log("삭제할 이미지 데이터:", imageData);

    // Storage에서 이미지 삭제
    if (imageData.storagePath) {
      try {
        const adminStorage = getStorage();
        const bucket = adminStorage.bucket();
        const file = bucket.file(imageData.storagePath);
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
    console.error("이미지 삭제 오류:", error);
    return NextResponse.json(
      {
        error: "이미지 삭제 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
