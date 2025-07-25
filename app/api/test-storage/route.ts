import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { storage } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 테스트 파일 경로
    const testFilePath = `uploads/${user.uid}/test-permissions.txt`;
    const testFile = storage.bucket().file(testFilePath);

    // 파일 쓰기 테스트
    try {
      await testFile.save("Test content for permissions", {
        metadata: {
          contentType: "text/plain",
        },
      });

      // 파일 읽기 테스트
      const [exists] = await testFile.exists();

      // 파일 삭제 테스트
      await testFile.delete();

      return NextResponse.json({
        success: true,
        message: "Firebase Storage permissions test passed",
        bucket: storage.bucket().name,
        userId: user.uid,
      });
    } catch (storageError) {
      console.error("❌ Storage test failed:", storageError);
      return NextResponse.json(
        {
          success: false,
          error: "Firebase Storage test failed",
          details:
            storageError instanceof Error
              ? storageError.message
              : "Unknown error",
          bucket: storage.bucket().name,
          userId: user.uid,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
