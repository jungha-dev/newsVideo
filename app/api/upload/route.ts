import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

    // Firebase Storage에 업로드
    const storageRef = ref(storage, path);
    const bytes = await file.arrayBuffer();
    const snapshot = await uploadBytes(storageRef, bytes);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return NextResponse.json({ url: downloadURL });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
