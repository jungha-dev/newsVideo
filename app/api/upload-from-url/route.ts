import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function POST(request: NextRequest) {
  try {
    const { url, path } = await request.json();

    console.log("Upload from URL request:", { url, path });

    if (!url || !path) {
      console.error("Missing URL or path");
      return NextResponse.json(
        { error: "URL과 경로가 필요합니다." },
        { status: 400 }
      );
    }

    console.log("Fetching file from URL:", url);

    // URL에서 파일 다운로드
    const response = await fetch(url);
    console.log("Fetch response status:", response.status);

    if (!response.ok) {
      console.error("Failed to fetch file:", response.statusText);
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    console.log("Converting to buffer...");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Buffer size:", buffer.length, "bytes");

    console.log("Uploading to Firebase Storage:", path);

    // Firebase Storage에 업로드
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, buffer);
    console.log("Upload snapshot:", snapshot);

    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("Download URL:", downloadURL);

    return NextResponse.json({ url: downloadURL });
  } catch (error) {
    console.error("Upload from URL error:", error);
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
