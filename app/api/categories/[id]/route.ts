import { NextRequest, NextResponse } from "next/server";
import { auth, db, storage } from "@/lib/firebase-admin";
import sharp from "sharp";

// 이미지를 80x80 크기로 리사이즈하는 함수
async function resizeImageTo80x80(imageBuffer: Buffer): Promise<Buffer> {
  try {
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
    return imageBuffer;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userEmail = decodedToken.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "사용자 이메일을 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    const { id } = params;

    // FormData 처리
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const image = formData.get("image") as File | null;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "카테고리 이름은 필수입니다." },
        { status: 400 }
      );
    }

    // 카테고리 존재 확인
    const categoryRef = db
      .collection("users")
      .doc(decodedToken.uid)
      .collection("categories")
      .doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const categoryData = categoryDoc.data();

    // 카테고리 이름 중복 확인 (자신 제외)
    const existingCategory = await db
      .collection("users")
      .doc(decodedToken.uid)
      .collection("categories")
      .where("name", "==", name.trim())
      .get();

    const hasDuplicate = existingCategory.docs.some((doc) => doc.id !== id);
    if (hasDuplicate) {
      return NextResponse.json(
        { error: "이미 존재하는 카테고리 이름입니다." },
        { status: 400 }
      );
    }

    // 이미지 업로드 처리
    let imageUrl = categoryData?.previewImage || "";
    if (image) {
      try {
        // 파일 타입 검증
        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(image.type)) {
          return NextResponse.json(
            {
              error:
                "지원하지 않는 파일 형식입니다. PNG, JPEG, GIF, WebP만 허용됩니다.",
            },
            { status: 400 }
          );
        }

        // 파일 크기 검증 (5MB 제한)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (image.size > maxSize) {
          return NextResponse.json(
            {
              error: "파일 크기가 너무 큽니다. 최대 5MB까지 허용됩니다.",
            },
            { status: 400 }
          );
        }

        // 기존 이미지가 있으면 삭제
        if (categoryData?.previewImage) {
          try {
            const bucket = storage.bucket();
            const oldFile = bucket.file(categoryData.previewImage);
            await oldFile.delete();
          } catch (deleteError) {
            console.warn("기존 이미지 삭제 실패:", deleteError);
            // 기존 이미지 삭제 실패해도 계속 진행
          }
        }

        // 새 이미지 업로드
        const imageBuffer = Buffer.from(await image.arrayBuffer());

        // 이미지를 80x80 크기로 리사이즈
        const resizedBuffer = await resizeImageTo80x80(imageBuffer);

        // storagePaths 유틸리티 사용
        const { getImageUploadPath, createSafeFilename } = await import(
          "../../../../utils/storagePaths"
        );

        const safeFilename = createSafeFilename(image.name, "cat");
        const imageFileName = getImageUploadPath({
          userId: decodedToken.uid,
          filename: safeFilename,
          category: "category",
        });

        const bucket = storage.bucket();
        const file = bucket.file(imageFileName);

        await file.save(resizedBuffer, {
          metadata: {
            contentType: "image/png", // 리사이즈 후 PNG로 Save
          },
        });

        // 공개 URL 생성
        await file.makePublic();
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${imageFileName}`;

        console.log("카테고리 이미지 업로드 성공:", imageUrl);
      } catch (error) {
        console.error("이미지 업로드 오류:", error);
        return NextResponse.json(
          { error: "이미지 업로드 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }
    }

    // 카테고리 업데이트
    await categoryRef.update({
      name: name.trim(),
      description: description?.trim() || "",
      previewImage: imageUrl,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: "카테고리가 성공적으로 수정되었습니다.",
      id,
      name: name.trim(),
      description: description?.trim() || "",
      previewImage: imageUrl,
    });
  } catch (error) {
    console.error("카테고리 수정 오류:", error);
    return NextResponse.json(
      { error: "카테고리 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    // const userEmail = decodedToken.email;

    const { id } = params;
    const { order } = await request.json();

    // 카테고리 존재 확인 (users/{uid}/categories/{id})
    const categoryRef = db
      .collection("users")
      .doc(decodedToken.uid)
      .collection("categories")
      .doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 순서 업데이트
    await categoryRef.update({
      order: order || 0,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: "카테고리 순서가 성공적으로 업데이트되었습니다.",
      id,
      order: order || 0,
    });
  } catch (error) {
    console.error("카테고리 순서 업데이트 오류:", error);
    return NextResponse.json(
      { error: "카테고리 순서 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    // const userEmail = decodedToken.email;

    const { id } = params;

    // 카테고리 존재 확인 (users/{uid}/categories/{id})
    const categoryRef = db
      .collection("users")
      .doc(decodedToken.uid)
      .collection("categories")
      .doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const categoryData = categoryDoc.data();
    if (!categoryData) {
      return NextResponse.json(
        { error: "카테고리 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 카테고리에 속한 이미지들을 "분류 없음"으로 이동
    const charactersRef = db
      .collection("users")
      .doc(decodedToken.uid)
      .collection("characters");
    const charactersQuery = await charactersRef
      .where("category", "==", categoryData.name)
      .get();

    const updatePromises = charactersQuery.docs.map((doc) =>
      doc.ref.update({ category: "uncategorized" })
    );

    await Promise.all(updatePromises);

    // 카테고리 이미지가 있으면 삭제
    if (categoryData?.previewImage) {
      try {
        const bucket = storage.bucket();
        const file = bucket.file(categoryData.previewImage);
        await file.delete();
      } catch (error) {
        console.error("카테고리 이미지 삭제 오류:", error);
        // 이미지 삭제 실패해도 카테고리는 삭제 진행
      }
    }

    // 카테고리 삭제
    await categoryRef.delete();

    return NextResponse.json({
      message: "카테고리가 성공적으로 삭제되었습니다.",
      id,
    });
  } catch (error) {
    console.error("카테고리 삭제 오류:", error);
    return NextResponse.json(
      { error: "카테고리 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
