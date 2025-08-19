import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;

    if (!file || !path) {
      return NextResponse.json(
        { error: "파일과 경로가 필요합니다." },
        { status: 400 }
      );
    }

    // Firebase Admin Storage에 업로드
    const bucket = storage.bucket();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 파일명에 확장자 추가 (MIME 타입 기반)
    const extension = file.type.split("/")[1] || "jpg";
    const fileName = `${path}.${extension}`;

    const fileUpload = bucket.file(fileName);

    // 파일 업로드
    await fileUpload.save(fileBuffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Firebase Storage 서명된 URL 생성 (7일 유효)
    const [signedUrl] = await fileUpload.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일
    });

    console.log(`✅ File uploaded successfully: ${signedUrl}`);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
